import { Router } from 'express';
import { WebhookController } from '@/controllers/webhookController';

const router = Router();

// Circle webhook endpoint (no authentication required - verified by signature)
router.post('/circle', WebhookController.handleCircleWebhook);

export default router;
