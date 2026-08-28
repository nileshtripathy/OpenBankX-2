import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri: required('MONGO_URI'),

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // Default TTLs (seconds) for the cache layer - see utils/cache.ts
    ttl: {
      blockchainConfig: Number(process.env.CACHE_TTL_BLOCKCHAIN_CONFIG) || 3600, // rarely changes
      balance: Number(process.env.CACHE_TTL_BALANCE) || 15, // on-chain reads are slow + rate-limited
      bankAccounts: Number(process.env.CACHE_TTL_BANK_ACCOUNTS) || 60,
    },
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  wallet: {
    signMessage:
      process.env.WALLET_SIGN_MESSAGE ||
      'Sign this message to authenticate with OpenBankX',
  },

  oauth: {
    // "Sign in with Google" via Google Identity Services on the frontend -
    // the frontend never sees a client secret, it just gets an ID token
    // from Google and hands it to us; we verify it server-side.
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || '',
    secret: process.env.PLAID_SECRET || '',
    env: process.env.PLAID_ENV || 'sandbox',
  },

  security: {
    // 32-byte hex key for AES-256-GCM, used to encrypt bank access tokens at rest.
    // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    encryptionKey:
      process.env.BANK_TOKEN_ENCRYPTION_KEY ||
      '0'.repeat(64), // INSECURE dev-only fallback - always set this in .env
  },

  blockchain: {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    chainId: Number(process.env.CHAIN_ID) || 31337, // Hardhat local network default
    vaultAddress: process.env.VAULT_CONTRACT_ADDRESS || '',
    swapAddress: process.env.SWAP_CONTRACT_ADDRESS || '',
    mockTokenAddress: process.env.MOCK_TOKEN_ADDRESS || '',
    // How many past blocks to scan for missed events on startup. Keep small
    // for fast boots; a persisted cursor (SyncState) takes over after that.
    backfillBlockRange: Number(process.env.BACKFILL_BLOCK_RANGE) || 5000,
  },

  cron: {
    // Standard 5-field cron expressions (node-cron). Defaults: every 6h and every 5min.
    bankRefreshSchedule: process.env.CRON_BANK_REFRESH_SCHEDULE || '0 */6 * * *',
    healthCheckSchedule: process.env.CRON_HEALTH_CHECK_SCHEDULE || '*/5 * * * *',
    enabled: process.env.CRON_ENABLED !== 'false',
  },

  isProd: process.env.NODE_ENV === 'production',
};

if (env.isProd && env.security.encryptionKey === '0'.repeat(64)) {
  throw new Error(
    'BANK_TOKEN_ENCRYPTION_KEY must be set to a real 32-byte hex key in production'
  );
}
