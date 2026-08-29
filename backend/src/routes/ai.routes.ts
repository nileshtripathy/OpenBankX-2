import { Router } from 'express';
import * as AiController from '../controllers/ai.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { aiRateLimiter } from '../middleware/rateLimit.middleware';
import { chatSchema } from '../validators/ai.validator';

const router = Router();

router.post('/chat', requireAuth, aiRateLimiter, validate(chatSchema), AiController.chat);

export default router;
