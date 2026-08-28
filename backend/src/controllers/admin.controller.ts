import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { AdminService } from '../services/admin.service';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await AdminService.listUsers(page, limit);
  return ApiResponse.send(res, 200, result, 'Users fetched');
});

export const setUserActive = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await AdminService.setUserActive(
    req.params.id,
    req.body.isActive,
    req.user.userId
  );
  return ApiResponse.send(res, 200, user, 'User status updated');
});
