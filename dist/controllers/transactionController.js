"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionController = void 0;
const database_1 = __importDefault(require("@/lib/database"));
class TransactionController {
    // Get user transactions in the format expected by frontend
    static async getUserTransactions(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const { page = 1, limit = 10 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);
            const transactions = await database_1.default.transaction.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
                include: {
                    wallet: {
                        select: { currency: true },
                    },
                },
            });
            // Mock exchange rates for conversion display
            const exchangeRates = {
                NGN: 0.00067,
                GBP: 1.27,
                EUR: 1.09,
                KES: 0.0064,
                GHS: 0.065,
                ZAR: 0.054,
                CAD: 0.74,
                AUD: 0.66,
                USD: 1.0,
            };
            // Transform transactions to match frontend format
            const formattedTransactions = transactions.map(transaction => {
                const amount = parseFloat(transaction.amount.toString());
                const rate = transaction.exchangeRate
                    ? parseFloat(transaction.exchangeRate.toString())
                    : exchangeRates[transaction.currency];
                const receivedAmount = amount * rate;
                return {
                    id: transaction.id,
                    type: transaction.type === 'TRANSFER_SEND' ? 'sent' : 'received',
                    recipient: transaction.recipientName,
                    sender: transaction.recipientName, // For received transactions, this would be the sender
                    amount: amount,
                    currency: transaction.currency,
                    receivedAmount: receivedAmount,
                    receivedCurrency: transaction.type === 'TRANSFER_SEND' ? 'USD' : transaction.currency,
                    status: transaction.status.toLowerCase(),
                    date: transaction.createdAt.toISOString(),
                    country: transaction.type === 'TRANSFER_SEND' ? 'United States' : 'Nigeria', // Mock country
                };
            });
            const response = {
                success: true,
                message: 'Transactions retrieved successfully',
                data: formattedTransactions,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve transactions',
            };
            res.status(500).json(response);
        }
    }
    // Create a new transaction
    static async createTransaction(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const { amount, sourceWallet, recipientName, recipientEmail, recipientPhone, recipientBankName, recipientAccountNumber, recipientRoutingNumber, paymentMethod, description, } = req.body;
            // Find the source wallet
            const wallet = await database_1.default.wallet.findFirst({
                where: {
                    userId: req.user.id,
                    currency: sourceWallet,
                    isActive: true,
                },
            });
            if (!wallet) {
                const response = {
                    success: false,
                    message: 'Wallet not found',
                };
                res.status(404).json(response);
                return;
            }
            // Check if user has sufficient balance
            const availableBalance = parseFloat(wallet.availableBalance.toString());
            if (availableBalance < amount) {
                const response = {
                    success: false,
                    message: 'Insufficient balance',
                };
                res.status(400).json(response);
                return;
            }
            // Create the transaction
            const transaction = await database_1.default.transaction.create({
                data: {
                    userId: req.user.id,
                    walletId: wallet.id,
                    type: 'TRANSFER_SEND',
                    status: 'PENDING',
                    amount: amount,
                    currency: sourceWallet,
                    fee: amount * 0.01, // 1% fee
                    recipientName,
                    recipientEmail,
                    recipientPhone,
                    recipientBankName,
                    recipientAccountNumber,
                    recipientRoutingNumber,
                    paymentMethod: paymentMethod?.toUpperCase(),
                    description,
                },
            });
            // Update wallet balance (reserve the amount)
            await database_1.default.wallet.update({
                where: { id: wallet.id },
                data: {
                    availableBalance: {
                        decrement: amount,
                    },
                    reservedBalance: {
                        increment: amount,
                    },
                },
            });
            // Create transaction status history
            await database_1.default.transactionStatusHistory.create({
                data: {
                    transactionId: transaction.id,
                    status: 'PENDING',
                    message: 'Transaction initiated',
                },
            });
            // Simulate processing (in real app, this would be handled by background jobs)
            // For now, we'll just return the transaction
            const response = {
                success: true,
                message: 'Transaction created successfully',
                data: {
                    id: transaction.id,
                    reference: transaction.reference,
                    status: transaction.status,
                    amount: parseFloat(transaction.amount.toString()),
                    currency: transaction.currency,
                    recipientName: transaction.recipientName,
                    createdAt: transaction.createdAt.toISOString(),
                },
            };
            res.status(201).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to create transaction',
            };
            res.status(500).json(response);
        }
    }
    // Get transaction by ID
    static async getTransactionById(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const { id } = req.params;
            const transaction = await database_1.default.transaction.findFirst({
                where: {
                    id,
                    userId: req.user.id,
                },
                include: {
                    wallet: {
                        select: { currency: true },
                    },
                    statusHistory: {
                        orderBy: { createdAt: 'asc' },
                    },
                },
            });
            if (!transaction) {
                const response = {
                    success: false,
                    message: 'Transaction not found',
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Transaction retrieved successfully',
                data: {
                    id: transaction.id,
                    reference: transaction.reference,
                    type: transaction.type,
                    status: transaction.status,
                    amount: parseFloat(transaction.amount.toString()),
                    currency: transaction.currency,
                    fee: parseFloat(transaction.fee.toString()),
                    recipientName: transaction.recipientName,
                    recipientEmail: transaction.recipientEmail,
                    recipientBankName: transaction.recipientBankName,
                    recipientAccountNumber: transaction.recipientAccountNumber,
                    paymentMethod: transaction.paymentMethod,
                    description: transaction.description,
                    createdAt: transaction.createdAt.toISOString(),
                    completedAt: transaction.completedAt?.toISOString(),
                    statusHistory: transaction.statusHistory.map(history => ({
                        status: history.status,
                        message: history.message,
                        createdAt: history.createdAt.toISOString(),
                    })),
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve transaction',
            };
            res.status(500).json(response);
        }
    }
}
exports.TransactionController = TransactionController;
//# sourceMappingURL=transactionController.js.map