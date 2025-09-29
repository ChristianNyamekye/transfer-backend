import { Router } from 'express';
import { ExchangeRateController } from '@/controllers/exchangeRateController';
import { optionalAuth } from '@/middleware/auth';

const router = Router();

// Apply optional auth - some endpoints can be public, others require auth
router.use(optionalAuth);

// Get current exchange rates
// GET /exchange-rates?base=USD&currencies=NGN,GHS,KES
router.get('/', ExchangeRateController.getCurrentRates);

// Convert currency amount
// GET /exchange-rates/convert?amount=100&from=NGN&to=USD
router.get('/convert', ExchangeRateController.convertCurrency);

// Get currency information
// GET /exchange-rates/currency/NGN
router.get('/currency/:currency', ExchangeRateController.getCurrencyInfo);

// Get all supported currencies
// GET /exchange-rates/currencies
router.get('/currencies', ExchangeRateController.getSupportedCurrencies);

// Manually update rates (admin only - we'll add admin auth later)
// POST /exchange-rates/update
router.post('/update', ExchangeRateController.updateRates);

export default router;
