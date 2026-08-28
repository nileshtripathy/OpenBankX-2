import { Router } from 'express';
import * as BankController from '../controllers/bank.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { exchangeSchema, accountIdParamSchema } from '../validators/bank.validator';

const router = Router();

router.use(requireAuth); // every route in this module requires a logged-in user

router.post('/link-token', BankController.createLinkToken);
router.post('/exchange', validate(exchangeSchema), BankController.exchangeToken);
router.get('/accounts', BankController.listAccounts);
router.post(
  '/accounts/:id/refresh',
  validate(accountIdParamSchema),
  BankController.refreshAccount
);
router.delete(
  '/accounts/:id',
  validate(accountIdParamSchema),
  BankController.unlinkAccount
);

export default router;
