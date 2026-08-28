// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title OpenBankXVault
/// @notice Holds user balances of native ETH and whitelisted ERC-20 tokens,
///         and lets users deposit, withdraw, and transfer between each other.
///         address(0) is used as the sentinel for native ETH throughout.
/// @dev All financial state lives here on-chain; the backend only reads
///      events emitted by this contract to build a fast off-chain index.
///      Checks-effects-interactions is followed on every external call site.
contract OpenBankXVault is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @notice balances[token][user] => amount held in the vault
    mapping(address => mapping(address => uint256)) private balances;

    /// @notice ERC-20 tokens approved for deposit. ETH (address(0)) is always allowed.
    mapping(address => bool) public supportedTokens;

    event TokenSupportUpdated(address indexed token, bool supported);
    event Deposited(address indexed user, address indexed token, uint256 amount, bytes32 refId);
    event Withdrawn(address indexed user, address indexed token, uint256 amount, bytes32 refId);
    event Transferred(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        bytes32 refId
    );

    error UnsupportedToken(address token);
    error ZeroAmount();
    error InsufficientBalance(uint256 available, uint256 requested);
    error EthTransferFailed();
    error InvalidRecipient();

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlySupported(address token) {
        if (token != address(0) && !supportedTokens[token]) revert UnsupportedToken(token);
        _;
    }

    /// @notice Owner-controlled allowlist for ERC-20 tokens. Keeps the vault from
    ///         accepting arbitrary/malicious tokens (fee-on-transfer, rebasing, etc).
    function setTokenSupported(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    /// @notice Deposit native ETH into the caller's vault balance.
    /// @param refId Off-chain reference id (e.g. hash of a client request) for idempotency/tracing.
    function depositETH(bytes32 refId) external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        balances[address(0)][msg.sender] += msg.value;
        emit Deposited(msg.sender, address(0), msg.value, refId);
    }

    /// @notice Deposit an approved ERC-20 token. Caller must have approved this
    ///         contract for at least `amount` beforehand.
    function depositToken(
        address token,
        uint256 amount,
        bytes32 refId
    ) external nonReentrant whenNotPaused onlySupported(token) {
        if (amount == 0) revert ZeroAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token][msg.sender] += amount;
        emit Deposited(msg.sender, token, amount, refId);
    }

    /// @notice Withdraw native ETH from the caller's vault balance.
    function withdrawETH(uint256 amount, bytes32 refId) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balances[address(0)][msg.sender];
        if (bal < amount) revert InsufficientBalance(bal, amount);

        // Effects before interaction
        balances[address(0)][msg.sender] = bal - amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert EthTransferFailed();

        emit Withdrawn(msg.sender, address(0), amount, refId);
    }

    /// @notice Withdraw an ERC-20 token from the caller's vault balance.
    function withdrawToken(
        address token,
        uint256 amount,
        bytes32 refId
    ) external nonReentrant whenNotPaused onlySupported(token) {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balances[token][msg.sender];
        if (bal < amount) revert InsufficientBalance(bal, amount);

        balances[token][msg.sender] = bal - amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount, refId);
    }

    /// @notice Instant internal transfer between two vault balances - no gas-heavy
    ///         token movement, just ledger accounting. Used for P2P sends inside OpenBankX.
    function transfer(
        address to,
        address token,
        uint256 amount,
        bytes32 refId
    ) external whenNotPaused onlySupported(token) {
        if (to == address(0) || to == msg.sender) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = balances[token][msg.sender];
        if (bal < amount) revert InsufficientBalance(bal, amount);

        balances[token][msg.sender] = bal - amount;
        balances[token][to] += amount;

        emit Transferred(msg.sender, to, token, amount, refId);
    }

    /// @notice Read a user's vault balance for a given token (address(0) = ETH).
    function balanceOf(address token, address user) external view returns (uint256) {
        return balances[token][user];
    }

    /// @notice Emergency stop for deposits/withdrawals/transfers. View functions unaffected.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @dev Reject stray ETH sent without calling depositETH, so funds are never
    ///      credited to nobody's balance.
    receive() external payable {
        revert("Use depositETH()");
    }
}
