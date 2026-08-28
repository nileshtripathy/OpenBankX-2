import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';
import { User } from '../models/User';

/**
 * Real-time layer for OpenBankX. Complements (doesn't replace) the existing
 * SSE transaction stream: SSE is a simple one-way feed used for the
 * transactions table, while this socket.io server is the general-purpose
 * bus other features push onto - currently bank balance refresh
 * notifications from the cron job, and on-chain event broadcasts keyed by
 * wallet address (see blockchainSync.service.ts).
 *
 * Every authenticated socket joins two rooms:
 *   - `user:<userId>`         - for events scoped to the logged-in account
 *   - `wallet:<address>`      - for events scoped to their linked wallet
 */

let io: SocketIOServer | null = null;

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    walletAddress?: string;
  };
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Auth middleware: client connects with `io(url, { auth: { token } })`.
  // We verify the same short-lived access token used for REST calls, so
  // there's a single source of truth for "who is this" across HTTP + WS.
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('Missing auth token'));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.userId);
      if (!user || !user.isActive) return next(new Error('User not found or inactive'));

      (socket as AuthedSocket).data.userId = payload.userId;
      (socket as AuthedSocket).data.walletAddress = user.walletAddress?.toLowerCase();
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authed = socket as AuthedSocket;
    socket.join(`user:${authed.data.userId}`);
    if (authed.data.walletAddress) {
      socket.join(`wallet:${authed.data.walletAddress}`);
    }

    socket.on('disconnect', () => {
      // socket.io removes room membership automatically on disconnect.
    });
  });

  console.log('[socket.io] realtime server initialized');
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToWallet(walletAddress: string, event: string, payload: unknown): void {
  io?.to(`wallet:${walletAddress.toLowerCase()}`).emit(event, payload);
}
