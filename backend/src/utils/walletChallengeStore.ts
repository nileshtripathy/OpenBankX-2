import crypto from 'crypto';

export interface Challenge {
  nonce: string;
  issuedAt: string; // ISO timestamp baked into the signed message
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the sign step

// In-memory is fine for a short-lived challenge; if you scale to multiple
// API instances, swap this for a Redis-backed store with the same interface.
const challenges = new Map<string, Challenge>();

function key(address: string): string {
  return address.toLowerCase();
}

export function createChallenge(walletAddress: string): Challenge {
  const challenge: Challenge = {
    nonce: crypto.randomBytes(16).toString('hex'),
    issuedAt: new Date().toISOString(),
    expiresAt: Date.now() + TTL_MS,
  };
  challenges.set(key(walletAddress), challenge);
  return challenge;
}

/** Consumes (deletes) the challenge so it cannot be replayed. */
export function consumeChallenge(walletAddress: string): Challenge | null {
  const entry = challenges.get(key(walletAddress));
  challenges.delete(key(walletAddress));
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

// Periodic cleanup of expired entries so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of challenges) {
    if (v.expiresAt < now) challenges.delete(k);
  }
}, 10 * 60 * 1000).unref();
