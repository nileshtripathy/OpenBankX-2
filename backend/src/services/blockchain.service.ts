import { ethers } from 'ethers';
import { provider, getVaultContract, getSwapContract, getErc20Contract, VaultAbi, SwapAbi, Erc20Abi } from '../config/blockchain';
import { env } from '../config/env';
import { BlockchainTransaction } from '../models/BlockchainTransaction';
import { ApiError } from '../utils/ApiError';
import { cacheWrap } from '../utils/cache';

// Cache key builders live next to the service that owns them so
// invalidation call sites (blockchainSync.service.ts) stay obviously in sync.
export const balanceCacheKey = (kind: 'vault' | 'wallet', wallet: string, token: string) =>
  `balance:${kind}:${wallet.toLowerCase()}:${token.toLowerCase()}`;

export const BlockchainService = {
  /** Public config the frontend needs to construct its own ethers contract instances. Static per deploy, so it's cached for an hour. */
  async getPublicConfig() {
    return cacheWrap('blockchain:config', env.redis.ttl.blockchainConfig, async () => ({
      rpcUrl: env.blockchain.rpcUrl,
      chainId: env.blockchain.chainId,
      vaultAddress: env.blockchain.vaultAddress,
      swapAddress: env.blockchain.swapAddress,
      mockTokenAddress: env.blockchain.mockTokenAddress,
      abis: { vault: VaultAbi, swap: SwapAbi, erc20: Erc20Abi },
    }));
  },

  /**
   * A user's balance held inside the OpenBankX vault (token=zero address means ETH).
   * Cached briefly - RPC balance reads are the slowest call on the dashboard's
   * critical path, and the cache is actively invalidated the moment a new
   * deposit/withdraw/transfer event is indexed (see blockchainSync.service.ts).
   */
  async getVaultBalance(walletAddress: string, token: string): Promise<string> {
    return cacheWrap(balanceCacheKey('vault', walletAddress, token), env.redis.ttl.balance, async () => {
      const vault = getVaultContract();
      const balance = await vault.balanceOf(token, walletAddress);
      return (balance as bigint).toString();
    });
  },

  /** A user's raw on-chain balance in their own wallet (not yet deposited to the vault). Same caching rationale as getVaultBalance. */
  async getWalletBalance(walletAddress: string, token: string): Promise<string> {
    return cacheWrap(balanceCacheKey('wallet', walletAddress, token), env.redis.ttl.balance, async () => {
      if (token === ethers.ZeroAddress) {
        const balance = await provider.getBalance(walletAddress);
        return balance.toString();
      }
      const erc20 = getErc20Contract(token);
      const balance = await erc20.balanceOf(walletAddress);
      return (balance as bigint).toString();
    });
  },

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<string> {
    const swap = getSwapContract();
    try {
      const amountOut = await swap.getAmountOut(tokenIn, tokenOut, amountIn);
      return (amountOut as bigint).toString();
    } catch {
      throw ApiError.badRequest('No pool exists for this token pair, or quote failed');
    }
  },

  async listTransactions(
    walletAddress: string,
    opts: { page: number; limit: number; eventType?: string }
  ) {
    const wallet = walletAddress.toLowerCase();
    // `participants` is a denormalized [walletAddress, counterpartyAddress]
    // array kept in sync at write time (blockchainSync.service.ts), so this
    // is a single equality match instead of an `$or` across two fields -
    // it's fully served by the compound index defined on the model.
    const filter: Record<string, unknown> = { participants: wallet };
    if (opts.eventType) filter.eventType = opts.eventType;

    const skip = (opts.page - 1) * opts.limit;
    const [items, total] = await Promise.all([
      BlockchainTransaction.find(filter)
        .sort({ blockNumber: -1, logIndex: -1 })
        .skip(skip)
        .limit(opts.limit),
      BlockchainTransaction.countDocuments(filter),
    ]);

    return {
      items,
      page: opts.page,
      limit: opts.limit,
      total,
      totalPages: Math.ceil(total / opts.limit),
    };
  },

  /**
   * Aggregation pipeline: counts this wallet's on-chain activity per event
   * type per calendar month. Deliberately counts events rather than summing
   * `amountIn`/`amountOut` - those are raw uint256 wei values stored as
   * strings specifically because they can exceed the range Mongo's
   * $sum/Decimal128 can represent safely, so summing them in-pipeline would
   * silently produce wrong numbers for large amounts.
   */
  async getTransactionActivitySummary(walletAddress: string) {
    const wallet = walletAddress.toLowerCase();

    return BlockchainTransaction.aggregate([
      { $match: { participants: wallet } },
      {
        $group: {
          _id: {
            year: { $year: '$blockTimestamp' },
            month: { $month: '$blockTimestamp' },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
          firstAt: { $min: '$blockTimestamp' },
          lastAt: { $max: '$blockTimestamp' },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1, '_id.eventType': 1 } },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          eventType: '$_id.eventType',
          count: 1,
          firstAt: 1,
          lastAt: 1,
        },
      },
    ]);
  },
};
