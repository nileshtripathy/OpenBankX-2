import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AuthService } from '../services/auth.service';
import { env } from '../config/env';

const REFRESH_COOKIE = 'obx_refresh_token';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await AuthService.register(
    req.body
  );
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return ApiResponse.send(
    res,
    201,
    { user, accessToken },
    'Account created successfully'
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await AuthService.login(
    req.body
  );
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return ApiResponse.send(res, 200, { user, accessToken }, 'Logged in');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token provided');

  const { user, accessToken, refreshToken } = await AuthService.refresh(token);
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return ApiResponse.send(res, 200, { user, accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (req.user) {
    await AuthService.logout(req.user.userId, token);
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return ApiResponse.send(res, 200, null, 'Logged out');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await AuthService.getProfile(req.user.userId);
  return ApiResponse.send(res, 200, profile, 'Profile fetched');
});

export const google = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await AuthService.googleLogin(
    req.body.idToken
  );
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
  return ApiResponse.send(res, 200, { user, accessToken }, 'Signed in with Google');
});
