import { Router } from 'express';
import { TransactionController } from '@/controllers/transactionController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas } from '@/utils/validation';

const router = Router();

// All transaction routes require authentication
router.use(authenticate);

// Get user transactions
router.get('/', TransactionController.getUserTransactions);

// Calculate transfer fees
router.get('/calculate-fees', TransactionController.calculateTransferFees);

// Create new money transfer
router.post('/transfer', validate(schemas.createTransfer), TransactionController.createTransfer);

// Update transaction status
router.put('/:id/status', TransactionController.updateTransactionStatus);

// Get transaction by ID
router.get('/:id', TransactionController.getTransactionById);

export default router;
