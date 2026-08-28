import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.mongoUri);
    console.log(`[db] connected to MongoDB (${env.nodeEnv})`);
  } catch (err) {
    console.error('[db] initial connection failed:', (err as Error).message);
    // Retry once after a short delay instead of crashing immediately -
    // useful when DB container is still starting up in dev/docker-compose.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await mongoose.connect(env.mongoUri);
    console.log('[db] connected to MongoDB on retry');
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected from MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err);
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
