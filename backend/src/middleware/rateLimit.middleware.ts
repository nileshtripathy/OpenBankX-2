import rateLimit from 'express-rate-limit';

/** Applies to /login, /register, /google, wallet nonce/verify - blunt protection against brute force / spam on auth-adjacent endpoints. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, please try again later.',
  },
});

/**
 * Looser, general-purpose limiter applied to every /api request (see
 * app.ts). Auth endpoints get the stricter limiter above *in addition* to
 * this one - defense in depth rather than relying on a single limiter to
 * cover both "someone is brute-forcing login" and "someone is hammering
 * the API generally".
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
});

/** Stricter limit for the AI assistant - each request is a real, billed LLM call, not a cheap DB read. */
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many assistant messages, please wait a few minutes and try again.',
  },
});
