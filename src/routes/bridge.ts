import { Router } from 'express';
import { BridgeController } from '@/controllers/bridgeController';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Initialize USDC bridge system (admin only - for now no auth required)
router.post('/initialize', BridgeController.initializeBridge);

// Get bridge liquidity status
router.get('/status', BridgeController.getBridgeStatus);

// All other bridge routes require authentication
router.use(authenticate);

// Trigger liquidity rebalancing
router.post('/rebalance', BridgeController.rebalanceLiquidity);

// Process bridge transfer (for testing)
router.post('/transfer', BridgeController.processBridgeTransfer);

export default router;
