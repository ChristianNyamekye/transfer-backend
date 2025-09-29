"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const database_1 = __importDefault(require("@/lib/database"));
const exchangeRateService_1 = require("@/services/exchangeRateService");
class WalletController {
    // Get user wallets in the format expected by frontend
    static async getUserWallets(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            // Get user wallets with current exchange rates
            const wallets = await database_1.default.wallet.findMany({
                where: {
                    userId: req.user.id,
                    isActive: true,
                },
                orderBy: { currency: 'asc' },
            });
            // Get real-time exchange rates from API
            const exchangeRates = await exchangeRateService_1.ExchangeRateService.getExchangeRates('USD');
            // Calculate total sent and received for each wallet
            const walletsWithStats = await Promise.all(wallets.map(async (wallet) => {
                const totalSent = await database_1.default.transaction.aggregate({
                    where: {
                        walletId: wallet.id,
                        type: 'TRANSFER_SEND',
                        status: 'COMPLETED',
                    },
                    _sum: { amount: true },
                });
                const totalReceived = await database_1.default.transaction.aggregate({
                    where: {
                        walletId: wallet.id,
                        type: 'TRANSFER_RECEIVE',
                        status: 'COMPLETED',
                    },
                    _sum: { amount: true },
                });
                const balance = parseFloat(wallet.balance.toString());
                const rate = exchangeRates[wallet.currency] || 1;
                const info = exchangeRateService_1.ExchangeRateService.getCurrencyInfo(wallet.currency);
                // Calculate USD equivalent correctly
                // If currency is USD, rate is 1:1
                // If currency is not USD, divide by the exchange rate (e.g., NGN 1484.89 = 1 USD, so 1 NGN = 1/1484.89 USD)
                const usdEquivalent = wallet.currency === 'USD' ? balance : balance / rate;
                return {
                    flag: info.flag,
                    currency: wallet.currency,
                    currencyName: info.name,
                    symbol: info.symbol,
                    balance: balance,
                    usdEquivalent: parseFloat(usdEquivalent.toFixed(2)),
                    totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
                    totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
                };
            }));
            const response = {
                success: true,
                message: 'Wallets retrieved successfully',
                data: walletsWithStats,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve wallets',
            };
            res.status(500).json(response);
        }
    }
    // Get wallet statistics for dashboard
    static async getWalletStats(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            // Get all user wallets
            const wallets = await database_1.default.wallet.findMany({
                where: {
                    userId: req.user.id,
                    isActive: true,
                },
            });
            // Calculate total sent across all wallets
            const totalSent = await database_1.default.transaction.aggregate({
                where: {
                    userId: req.user.id,
                    type: 'TRANSFER_SEND',
                    status: 'COMPLETED',
                },
                _sum: { amount: true },
                _count: { id: true },
            });
            // Calculate total received across all wallets
            const totalReceived = await database_1.default.transaction.aggregate({
                where: {
                    userId: req.user.id,
                    type: 'TRANSFER_RECEIVE',
                    status: 'COMPLETED',
                },
                _sum: { amount: true },
            });
            // Count active transfers
            const activeTransfers = await database_1.default.transaction.count({
                where: {
                    userId: req.user.id,
                    status: {
                        in: ['PENDING', 'PROCESSING'],
                    },
                },
            });
            // Count saved recipients (unique recipient names from completed transfers)
            const savedRecipients = await database_1.default.transaction.groupBy({
                by: ['recipientName'],
                where: {
                    userId: req.user.id,
                    type: 'TRANSFER_SEND',
                    recipientName: { not: null },
                },
            });
            const stats = {
                totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
                totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
                activeTransfers: activeTransfers,
                savedRecipients: savedRecipients.length,
                totalTransactions: totalSent._count.id || 0,
            };
            const response = {
                success: true,
                message: 'Wallet statistics retrieved successfully',
                data: stats,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve wallet statistics',
            };
            res.status(500).json(response);
        }
    }
    // Add new currency wallet
    static async addCurrencyWallet(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const { currency } = req.body;
            // Check if wallet already exists
            const existingWallet = await database_1.default.wallet.findFirst({
                where: {
                    userId: req.user.id,
                    currency: currency,
                },
            });
            if (existingWallet) {
                const response = {
                    success: false,
                    message: `${currency} wallet already exists`,
                };
                res.status(409).json(response);
                return;
            }
            // Create new wallet
            const wallet = await database_1.default.wallet.create({
                data: {
                    userId: req.user.id,
                    currency: currency,
                    balance: 0,
                    availableBalance: 0,
                    reservedBalance: 0,
                },
            });
            const response = {
                success: true,
                message: `${currency} wallet created successfully`,
                data: {
                    id: wallet.id,
                    currency: wallet.currency,
                    balance: parseFloat(wallet.balance.toString()),
                    availableBalance: parseFloat(wallet.availableBalance.toString()),
                },
            };
            res.status(201).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to create wallet',
            };
            res.status(500).json(response);
        }
    }
    // Add funds to wallet (for testing - in production this would be through payment processing)
    static async addFunds(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const { currency, amount } = req.body;
            if (!currency || !amount || amount <= 0) {
                const response = {
                    success: false,
                    message: 'Currency and positive amount are required',
                };
                res.status(400).json(response);
                return;
            }
            // Find the wallet
            const wallet = await database_1.default.wallet.findFirst({
                where: {
                    userId: req.user.id,
                    currency: currency,
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
            // Update wallet balance
            const updatedWallet = await database_1.default.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: {
                        increment: amount,
                    },
                    availableBalance: {
                        increment: amount,
                    },
                },
            });
            // Create transaction record
            await database_1.default.transaction.create({
                data: {
                    userId: req.user.id,
                    walletId: wallet.id,
                    type: 'DEPOSIT',
                    status: 'COMPLETED',
                    amount: amount,
                    currency: currency,
                    fee: 0,
                    description: 'Test deposit',
                },
            });
            const response = {
                success: true,
                message: `${currency} ${amount} added to wallet successfully`,
                data: {
                    currency: currency,
                    newBalance: parseFloat(updatedWallet.balance.toString()),
                    amountAdded: amount,
                },
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to add funds',
            };
            res.status(500).json(response);
        }
    }
}
exports.WalletController = WalletController;
//# sourceMappingURL=walletController.js.map