import { Router } from 'express';
import { BankAccountController } from '@/controllers/bankAccountController';
import { OnrampController } from '@/controllers/onrampController';
import { authenticate } from '@/middleware/auth';

const router = Router();

// All bank account routes require authentication
router.use(authenticate);

// Link new bank account
router.post('/link', BankAccountController.linkBankAccount);

// Get user's bank accounts
router.get('/', BankAccountController.getBankAccounts);

// Verify bank account
router.post('/:bankAccountId/verify', BankAccountController.verifyBankAccount);

// Set primary bank account
router.put('/:bankAccountId/primary', BankAccountController.setPrimaryBankAccount);

// Remove bank account
router.delete('/:bankAccountId', BankAccountController.removeBankAccount);

// Onramp operations (Bank → USDC → Wallet)
router.post('/onramp', OnrampController.createOnrampTransfer);
router.get('/onramp', OnrampController.getOnrampTransactions);

export default router;
