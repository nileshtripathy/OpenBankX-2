import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** The API base URL is like `http://localhost:5000/api` - socket.io needs the origin, not the /api path. */
function socketUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  return apiUrl.replace(/\/api\/?$/, '');
}

/**
 * Returns a shared socket connected + authenticated for the given access
 * token. Reuses the existing connection when the token hasn't changed, and
 * re-authenticates (fresh connection) when it has, e.g. after a token
 * refresh or a different user logging in.
 */
export function getSocket(accessToken: string): Socket {
  if (socket && socket.auth && (socket.auth as { token?: string }).token === accessToken) {
    return socket;
  }

  socket?.disconnect();
  socket = io(socketUrl(), {
    path: '/socket.io',
    auth: { token: accessToken },
    withCredentials: true,
    autoConnect: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
