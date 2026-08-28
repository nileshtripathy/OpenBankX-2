import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { BlockchainService } from '../services/blockchain.service';
import { txEvents } from '../services/blockchainSync.service';
import { User } from '../models/User';
import { verifyAccessToken } from '../utils/jwt';

async function requireLinkedWallet(userId: string): Promise<string> {
  const user = await User.findById(userId);
  if (!user?.walletAddress) {
    throw ApiError.badRequest('Link a wallet to your account before using on-chain features');
  }
  return user.walletAddress;
}

export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
  const config = await BlockchainService.getPublicConfig();
  return ApiResponse.send(res, 200, config, 'Blockchain config');
});

export const getVaultBalance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const wallet = await requireLinkedWallet(req.user.userId);
  const balance = await BlockchainService.getVaultBalance(wallet, req.query.token as string);
  return ApiResponse.send(res, 200, { balance }, 'Vault balance fetched');
});

export const getWalletBalance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const wallet = await requireLinkedWallet(req.user.userId);
  const balance = await BlockchainService.getWalletBalance(wallet, req.query.token as string);
  return ApiResponse.send(res, 200, { balance }, 'Wallet balance fetched');
});

export const getSwapQuote = asyncHandler(async (req: Request, res: Response) => {
  const { tokenIn, tokenOut, amountIn } = req.query as Record<string, string>;
  const amountOut = await BlockchainService.getSwapQuote(tokenIn, tokenOut, amountIn);
  return ApiResponse.send(res, 200, { amountOut }, 'Swap quote fetched');
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const wallet = await requireLinkedWallet(req.user.userId);
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const eventType = req.query.eventType as string | undefined;

  const result = await BlockchainService.listTransactions(wallet, { page, limit, eventType });
  return ApiResponse.send(res, 200, result, 'Transactions fetched');
});

/**
 * Server-Sent Events stream of this user's transactions as they're indexed
 * from on-chain events in real time. EventSource can't set an Authorization
 * header, so the access token is passed as a query param instead.
 */
export const streamTransactions = asyncHandler(async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined;
  if (!token) throw ApiError.unauthorized('Missing token');

  let userId: string;
  try {
    userId = verifyAccessToken(token).userId;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  const wallet = await requireLinkedWallet(userId);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(': connected\n\n');

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  const onTx = (doc: { walletAddress: string; counterpartyAddress?: string }) => {
    if (doc.walletAddress === wallet || doc.counterpartyAddress === wallet) {
      res.write(`data: ${JSON.stringify(doc)}\n\n`);
    }
  };
  txEvents.on('tx', onTx);

  req.on('close', () => {
    clearInterval(heartbeat);
    txEvents.off('tx', onTx);
    res.end();
  });
});
