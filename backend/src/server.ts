import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { connectRedis, disconnectRedis } from './config/redis';
import { env } from './config/env';
import { initBlockchainSync } from './services/blockchainSync.service';
import { initSocketServer } from './realtime/socket';
import { startScheduledJobs, stopScheduledJobs } from './jobs/scheduler';

async function main() {
  await connectDB();
  await connectRedis();
  await initBlockchainSync();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] OpenBankX API running on port ${env.port} (${env.nodeEnv})`);
  });

  // Socket.IO attaches to the same HTTP server/port - no second port to expose.
  initSocketServer(server);
  startScheduledJobs();

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down gracefully`);
    stopScheduledJobs();
    server.close(async () => {
      await disconnectDB();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled rejection:', reason);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
