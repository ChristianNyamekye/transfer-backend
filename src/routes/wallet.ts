import { Router } from 'express';
import { WalletController } from '@/controllers/walletController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas } from '@/utils/validation';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Get user wallets
router.get('/', WalletController.getUserWallets);

// Get wallet statistics
router.get('/stats', WalletController.getWalletStats);

// Add new currency wallet
router.post('/add', validate(schemas.addCurrencyWallet), WalletController.addCurrencyWallet);

// Add funds to wallet (for testing)
router.post('/add-funds', WalletController.addFunds);

export default router;
