import { Router } from 'express';
import authRoutes from './auth.routes';
import walletRoutes from './wallet.routes';
import bankRoutes from './bank.routes';
import blockchainRoutes from './blockchain.routes';
import adminRoutes from './admin.routes';
import aiRoutes from './ai.routes';
// Future modules mount here as they're built:
// import walletBalanceRoutes from './balance.routes';
// import swapRoutes from './swap.routes';
// import transactionRoutes from './transaction.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OpenBankX API is healthy' });
});

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/bank', bankRoutes);
router.use('/blockchain', blockchainRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);
// router.use('/balances', walletBalanceRoutes);
// router.use('/swap', swapRoutes);
// router.use('/transactions', transactionRoutes);

export default router;
