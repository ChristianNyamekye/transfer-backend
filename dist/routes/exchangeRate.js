"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exchangeRateController_1 = require("@/controllers/exchangeRateController");
const auth_1 = require("@/middleware/auth");
const router = (0, express_1.Router)();
// Apply optional auth - some endpoints can be public, others require auth
router.use(auth_1.optionalAuth);
// Get current exchange rates
// GET /exchange-rates?base=USD&currencies=NGN,GHS,KES
router.get('/', exchangeRateController_1.ExchangeRateController.getCurrentRates);
// Convert currency amount
// GET /exchange-rates/convert?amount=100&from=NGN&to=USD
router.get('/convert', exchangeRateController_1.ExchangeRateController.convertCurrency);
// Get currency information
// GET /exchange-rates/currency/NGN
router.get('/currency/:currency', exchangeRateController_1.ExchangeRateController.getCurrencyInfo);
// Get all supported currencies
// GET /exchange-rates/currencies
router.get('/currencies', exchangeRateController_1.ExchangeRateController.getSupportedCurrencies);
// Manually update rates (admin only - we'll add admin auth later)
// POST /exchange-rates/update
router.post('/update', exchangeRateController_1.ExchangeRateController.updateRates);
exports.default = router;
//# sourceMappingURL=exchangeRate.js.map