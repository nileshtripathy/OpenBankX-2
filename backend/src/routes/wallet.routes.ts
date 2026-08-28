import { Router } from 'express';
import * as WalletController from '../controllers/wallet.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { nonceSchema, verifySchema } from '../validators/wallet.validator';

const router = Router();

router.post(
  '/nonce',
  authRateLimiter,
  validate(nonceSchema),
  WalletController.requestNonce
);
router.post(
  '/verify',
  authRateLimiter,
  validate(verifySchema),
  WalletController.verify
);
router.post('/link', requireAuth, validate(verifySchema), WalletController.link);

export default router;
