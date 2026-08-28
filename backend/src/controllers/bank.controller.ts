import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { BankService } from '../services/bank.service';

export const createLinkToken = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await BankService.createLinkToken(req.user.userId);
  return ApiResponse.send(res, 200, result, 'Link token created');
});

export const exchangeToken = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const accounts = await BankService.exchangePublicToken(
    req.user.userId,
    req.body.publicToken
  );
  return ApiResponse.send(res, 201, accounts, 'Bank account(s) linked successfully');
});

export const listAccounts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const accounts = await BankService.listAccounts(req.user.userId);
  return ApiResponse.send(res, 200, accounts, 'Bank accounts fetched');
});

export const refreshAccount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const accounts = await BankService.refreshBalances(req.user.userId, [req.params.id]);
  if (accounts.length === 0) throw ApiError.notFound('Bank account not found');
  return ApiResponse.send(res, 200, accounts[0], 'Balance refreshed');
});

export const unlinkAccount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await BankService.unlinkAccount(req.user.userId, req.params.id);
  return ApiResponse.send(res, 200, result, 'Bank account unlinked');
});
