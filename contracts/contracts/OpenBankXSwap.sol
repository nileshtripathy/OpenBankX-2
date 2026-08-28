// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title OpenBankXSwap
/// @notice Minimal constant-product (x*y=k) AMM supporting ETH<->ERC20 and
///         ERC20<->ERC20 pools, in the spirit of Uniswap V2's core. address(0)
///         is the sentinel for native ETH, same convention as the Vault.
/// @dev Pools are permissioned (owner-created) rather than permissionless, so
///      OpenBankX only lists pairs it has vetted - appropriate for a banking
///      product rather than an open DEX. Fee is a fixed 0.3%, taken from the
///      input amount, and stays in the pool for liquidity providers.
contract OpenBankXSwap is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 private constant FEE_NUMERATOR = 997; // 0.3% fee
    uint256 private constant FEE_DENOMINATOR = 1000;
    uint256 private constant MINIMUM_LIQUIDITY = 1000; // locked forever, prevents share-price manipulation

    struct Pool {
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalLiquidity;
        bool exists;
    }

    /// @dev poolId => Pool. tokenA/tokenB stored implicitly via poolKey below.
    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public liquidityOf;
    /// @dev poolId => the two tokens it holds, in canonical (sorted) order.
    mapping(bytes32 => address[2]) public poolTokens;

    event PoolCreated(bytes32 indexed poolId, address indexed tokenA, address indexed tokenB);
    event LiquidityAdded(bytes32 indexed poolId, address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityMinted);
    event LiquidityRemoved(bytes32 indexed poolId, address indexed provider, uint256 amountA, uint256 amountB, uint256 liquidityBurned);
    event Swapped(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 refId
    );

    error PoolExists();
    error PoolNotFound();
    error IdenticalTokens();
    error ZeroAmount();
    error InsufficientLiquidity();
    error SlippageExceeded(uint256 amountOut, uint256 minAmountOut);
    error EthMismatch();
    error EthTransferFailed();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @dev Canonical, order-independent pool id so swap(A,B) and swap(B,A) hit the same pool.
    function _poolId(address tokenA, address tokenB) internal pure returns (bytes32, address, address) {
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return (keccak256(abi.encodePacked(t0, t1)), t0, t1);
    }

    /// @notice Owner creates a new tradeable pair. Kept permissioned so OpenBankX
    ///         controls which assets are listed for swapping.
    function createPool(address tokenA, address tokenB) external onlyOwner {
        if (tokenA == tokenB) revert IdenticalTokens();
        (bytes32 id, address t0, address t1) = _poolId(tokenA, tokenB);
        if (pools[id].exists) revert PoolExists();

        pools[id] = Pool({reserveA: 0, reserveB: 0, totalLiquidity: 0, exists: true});
        poolTokens[id] = [t0, t1];
        emit PoolCreated(id, t0, t1);
    }

    /// @notice Add liquidity to a pool. Send ETH via msg.value if one side is address(0).
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB
    ) external payable nonReentrant returns (uint256 liquidityMinted) {
        (bytes32 id, address t0, address t1) = _poolId(tokenA, tokenB);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        if (amountA == 0 || amountB == 0) revert ZeroAmount();

        // Map (amountA, amountB) as given by caller onto canonical (t0, t1) order.
        (uint256 amount0, uint256 amount1) = tokenA == t0 ? (amountA, amountB) : (amountB, amountA);

        _pullFunds(t0, amount0);
        _pullFunds(t1, amount1);

        if (pool.totalLiquidity == 0) {
            liquidityMinted = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            pool.totalLiquidity = liquidityMinted + MINIMUM_LIQUIDITY; // lock minimum liquidity permanently
        } else {
            uint256 shareFrom0 = (amount0 * pool.totalLiquidity) / pool.reserveA;
            uint256 shareFrom1 = (amount1 * pool.totalLiquidity) / pool.reserveB;
            liquidityMinted = shareFrom0 < shareFrom1 ? shareFrom0 : shareFrom1;
            pool.totalLiquidity += liquidityMinted;
        }
        if (liquidityMinted == 0) revert InsufficientLiquidity();

        pool.reserveA += amount0;
        pool.reserveB += amount1;
        liquidityOf[id][msg.sender] += liquidityMinted;

        emit LiquidityAdded(id, msg.sender, amount0, amount1, liquidityMinted);
    }

    /// @notice Burn LP shares and withdraw the proportional underlying reserves.
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidityAmount
    ) external nonReentrant returns (uint256 amountOut0, uint256 amountOut1) {
        (bytes32 id, address t0, address t1) = _poolId(tokenA, tokenB);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        uint256 owned = liquidityOf[id][msg.sender];
        if (liquidityAmount == 0 || liquidityAmount > owned) revert InsufficientLiquidity();

        amountOut0 = (liquidityAmount * pool.reserveA) / pool.totalLiquidity;
        amountOut1 = (liquidityAmount * pool.reserveB) / pool.totalLiquidity;

        liquidityOf[id][msg.sender] = owned - liquidityAmount;
        pool.totalLiquidity -= liquidityAmount;
        pool.reserveA -= amountOut0;
        pool.reserveB -= amountOut1;

        _pushFunds(t0, msg.sender, amountOut0);
        _pushFunds(t1, msg.sender, amountOut1);

        emit LiquidityRemoved(id, msg.sender, amountOut0, amountOut1, liquidityAmount);
    }

    /// @notice Swap an exact input amount of one token for the other side of the pool.
    /// @param minAmountOut Slippage guard - reverts if the quoted output is below this.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 refId
    ) external payable nonReentrant returns (uint256 amountOut) {
        (bytes32 id, address t0, ) = _poolId(tokenIn, tokenOut);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();
        if (amountIn == 0) revert ZeroAmount();

        _pullFunds(tokenIn, amountIn);

        bool inIsToken0 = tokenIn == t0;
        (uint256 reserveIn, uint256 reserveOut) = inIsToken0
            ? (pool.reserveA, pool.reserveB)
            : (pool.reserveB, pool.reserveA);

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
        if (amountOut < minAmountOut) revert SlippageExceeded(amountOut, minAmountOut);
        if (amountOut >= reserveOut) revert InsufficientLiquidity();

        if (inIsToken0) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }

        _pushFunds(tokenOut, msg.sender, amountOut);

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut, refId);
    }

    /// @notice Read-only quote for the UI to preview a swap before submitting it.
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        (bytes32 id, address t0, ) = _poolId(tokenIn, tokenOut);
        Pool storage pool = pools[id];
        if (!pool.exists) revert PoolNotFound();

        bool inIsToken0 = tokenIn == t0;
        (uint256 reserveIn, uint256 reserveOut) = inIsToken0
            ? (pool.reserveA, pool.reserveB)
            : (pool.reserveB, pool.reserveA);

        uint256 amountInWithFee = amountIn * FEE_NUMERATOR;
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
    }

    function _pullFunds(address token, uint256 amount) internal {
        if (token == address(0)) {
            if (msg.value != amount) revert EthMismatch();
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }
    }

    function _pushFunds(address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            if (!ok) revert EthTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
