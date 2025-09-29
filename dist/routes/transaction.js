"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transactionController_1 = require("@/controllers/transactionController");
const auth_1 = require("@/middleware/auth");
const validation_1 = require("@/utils/validation");
const router = (0, express_1.Router)();
// All transaction routes require authentication
router.use(auth_1.authenticate);
// Get user transactions
router.get('/', transactionController_1.TransactionController.getUserTransactions);
// Create new transaction
router.post('/', (0, validation_1.validate)(validation_1.schemas.createTransfer), transactionController_1.TransactionController.createTransaction);
// Get transaction by ID
router.get('/:id', transactionController_1.TransactionController.getTransactionById);
exports.default = router;
//# sourceMappingURL=transaction.js.map