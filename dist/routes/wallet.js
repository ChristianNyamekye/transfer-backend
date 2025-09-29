"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const walletController_1 = require("@/controllers/walletController");
const auth_1 = require("@/middleware/auth");
const validation_1 = require("@/utils/validation");
const router = (0, express_1.Router)();
// All wallet routes require authentication
router.use(auth_1.authenticate);
// Get user wallets
router.get('/', walletController_1.WalletController.getUserWallets);
// Get wallet statistics
router.get('/stats', walletController_1.WalletController.getWalletStats);
// Add new currency wallet
router.post('/add', (0, validation_1.validate)(validation_1.schemas.addCurrencyWallet), walletController_1.WalletController.addCurrencyWallet);
// Add funds to wallet (for testing)
router.post('/add-funds', walletController_1.WalletController.addFunds);
exports.default = router;
//# sourceMappingURL=wallet.js.map