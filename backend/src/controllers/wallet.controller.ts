import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { WalletService } from '../services/wallet.service';
import { env } from '../config/env';

const REFRESH_COOKIE = 'obx_refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const requestNonce = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress } = req.body;
  const { message } = WalletService.requestNonce(walletAddress);
  return ApiResponse.send(res, 200, { message }, 'Sign this message in your wallet');
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const { walletAddress, signature } = req.body;
  const { user, accessToken, refreshToken } = await WalletService.verifyAndLogin(
    walletAddress,
    signature
  );
  // Reuse the same refresh cookie path as email auth so /auth/refresh works for both
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return ApiResponse.send(res, 200, { user, accessToken }, 'Wallet login successful');
});

export const link = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { walletAddress, signature } = req.body;
  const user = await WalletService.linkWallet(
    req.user.userId,
    walletAddress,
    signature
  );
  return ApiResponse.send(res, 200, user, 'Wallet linked to your account');
});
