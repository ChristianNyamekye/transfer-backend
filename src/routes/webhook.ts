import { Router } from 'express';
import { WebhookController } from '@/controllers/webhookController';
import RampnowWebhookController from '@/controllers/rampnowWebhookController';

const router = Router();

// Circle webhook endpoint (no authentication required - verified by signature)
router.post('/circle', WebhookController.handleCircleWebhook);

// Rampnow webhook endpoint
router.post('/rampnow', RampnowWebhookController.handle);

export default router;
