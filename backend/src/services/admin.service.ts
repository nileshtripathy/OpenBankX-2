import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { sanitize } from './auth.service';

export const AdminService = {
  /** Paginated user list - the kind of endpoint that must never be reachable by a non-admin. */
  async listUsers(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);

    return {
      items: items.map(sanitize),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Activates/deactivates a user account. Deactivation also revokes every
   * refresh token they currently hold, so it takes effect immediately
   * instead of waiting for their session to expire on its own.
   */
  async setUserActive(targetUserId: string, isActive: boolean, actingAdminId: string) {
    if (targetUserId === actingAdminId && !isActive) {
      throw ApiError.badRequest('You cannot deactivate your own admin account');
    }

    const user = await User.findById(targetUserId).select('+refreshTokens');
    if (!user) throw ApiError.notFound('User not found');

    user.isActive = isActive;
    if (!isActive) user.refreshTokens = [];
    await user.save();

    return sanitize(user);
  },
};
