import { Router } from 'express';
import * as BlockchainController from '../controllers/blockchain.controller';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import {
  balanceQuerySchema,
  quoteQuerySchema,
  transactionsQuerySchema,
} from '../validators/blockchain.validator';

const router = Router();

// Public: contract addresses/ABIs and swap quotes aren't sensitive.
router.get('/config', BlockchainController.getConfig);
router.get('/quote', validate(quoteQuerySchema), BlockchainController.getSwapQuote);

// SSE auths itself via query token (see controller) rather than requireAuth,
// since EventSource cannot set custom headers.
router.get('/transactions/stream', BlockchainController.streamTransactions);

router.use(requireAuth);
router.get('/balance/vault', validate(balanceQuerySchema), BlockchainController.getVaultBalance);
router.get('/balance/wallet', validate(balanceQuerySchema), BlockchainController.getWalletBalance);
router.get('/transactions', validate(transactionsQuerySchema), BlockchainController.listTransactions);
router.get('/transactions/summary', BlockchainController.getTransactionsSummary);

export default router;
