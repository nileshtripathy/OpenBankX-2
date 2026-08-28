import { User, IUser } from '../models/User';
import { ApiError } from '../utils/ApiError';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const googleClient = env.oauth.googleClientId ? new OAuth2Client(env.oauth.googleClientId) : null;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function issueTokens(user: IUser): AuthTokens {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    email: user.email ?? '',
    role: user.role,
  });
  const refreshToken = signRefreshToken({ userId: user._id.toString() });
  return { accessToken, refreshToken };
}

export function sanitize(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    walletAddress: user.walletAddress ?? null,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export const AuthService = {
  async register(input: RegisterInput) {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const user = await User.create({
      name: input.name,
      email: input.email,
      password: input.password,
    });

    const tokens = issueTokens(user);
    user.refreshTokens = [tokens.refreshToken];
    await user.save();

    return { user: sanitize(user), ...tokens };
  },

  async login(input: LoginInput) {
    const user = await User.findOne({ email: input.email }).select(
      '+password +refreshTokens'
    );
    if (!user || !(await user.comparePassword(input.password))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    const tokens = issueTokens(user);
    // Keep a bounded list of active refresh tokens (max 5 devices)
    user.refreshTokens = [...user.refreshTokens.slice(-4), tokens.refreshToken];
    await user.save();

    return { user: sanitize(user), ...tokens };
  },

  async refresh(refreshToken: string) {
    let payload: { userId: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(payload.userId).select('+refreshTokens');
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      // Token reuse or unknown user - revoke everything as a precaution
      if (user) {
        user.refreshTokens = [];
        await user.save();
      }
      throw ApiError.unauthorized('Refresh token is no longer valid');
    }

    const tokens = issueTokens(user);
    user.refreshTokens = [
      ...user.refreshTokens.filter((t) => t !== refreshToken),
      tokens.refreshToken,
    ];
    await user.save();

    return { user: sanitize(user), ...tokens };
  },

  async logout(userId: string, refreshToken?: string) {
    const user = await User.findById(userId).select('+refreshTokens');
    if (!user) return;

    user.refreshTokens = refreshToken
      ? user.refreshTokens.filter((t) => t !== refreshToken)
      : []; // no token provided -> log out of all devices
    await user.save();
  },

  async getProfile(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return sanitize(user);
  },

  /**
   * "Sign in with Google": the frontend uses Google Identity Services to get
   * a signed ID token directly from Google, then hands it to us here. We
   * verify the token's signature + audience server-side (never trusting
   * anything the client claims about the user), then find-or-create a local
   * account and issue our own access/refresh token pair - so from this
   * point on, a Google-authenticated user is indistinguishable from an
   * email/password user anywhere else in the app.
   */
  async googleLogin(idToken: string) {
    if (!googleClient) {
      throw ApiError.badRequest('Google sign-in is not configured on this server');
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.oauth.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw ApiError.unauthorized('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email) {
      throw ApiError.unauthorized('Google credential did not include the expected profile data');
    }
    if (!payload.email_verified) {
      throw ApiError.unauthorized('Google account email is not verified');
    }

    let user: IUser | null = await User.findOne({ googleId: payload.sub }).select(
      '+refreshTokens'
    );

    if (!user) {
      // Link by email if an account already exists (e.g. they registered
      // with password first, then try "Continue with Google" later) rather
      // than creating a duplicate account for the same person.
      const existingByEmail = await User.findOne({ email: payload.email }).select(
        '+refreshTokens'
      );
      if (existingByEmail) {
        existingByEmail.googleId = payload.sub;
        user = existingByEmail;
      } else {
        const created = await User.create({
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          googleId: payload.sub,
        });
        user = await User.findById(created._id).select('+refreshTokens');
      }
    }

    if (!user) throw ApiError.unauthorized('Could not resolve Google account');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

    const tokens = issueTokens(user);
    user.refreshTokens = [...user.refreshTokens.slice(-4), tokens.refreshToken];
    await user.save();

    return { user: sanitize(user), ...tokens };
  },
};
