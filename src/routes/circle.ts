import { Router } from 'express';
import { CircleController } from '@/controllers/circleController';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Test Circle API connection (public endpoint for testing)
router.get('/test', CircleController.testConnection);

// All other Circle routes require authentication
router.use(authenticate);

// Circle Gateway initialization
router.post('/gateway/initialize', CircleController.initializeGateway);

// Circle wallet management
router.post('/wallet', CircleController.createWallet);
router.get('/wallet/balance', CircleController.getWalletBalance);

// Circle Gateway - Unified USDC
router.get('/gateway/status', CircleController.getGatewayStatus);
router.get('/gateway/balance', CircleController.getGatewayBalance);
router.post('/gateway/transfer', CircleController.createGatewayTransfer);

export default router;
