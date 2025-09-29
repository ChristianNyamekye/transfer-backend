"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("@/middleware/auth");
const config_1 = __importDefault(require("@/config"));
const database_1 = __importDefault(require("@/lib/database"));
class AuthController {
    // User registration
    static async register(req, res) {
        try {
            const { email, password, firstName, lastName, phone } = req.body;
            // Check if user already exists
            const existingUser = await database_1.default.user.findFirst({
                where: {
                    OR: [{ email }, ...(phone ? [{ phone }] : [])],
                },
            });
            if (existingUser) {
                const response = {
                    success: false,
                    message: existingUser.email === email
                        ? 'User with this email already exists'
                        : 'User with this phone number already exists',
                };
                res.status(409).json(response);
                return;
            }
            // Hash password
            const hashedPassword = await bcryptjs_1.default.hash(password, config_1.default.BCRYPT_ROUNDS);
            // Create user
            const user = await database_1.default.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    firstName,
                    lastName,
                    phone,
                },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    isEmailVerified: true,
                    isPhoneVerified: true,
                    kycStatus: true,
                    profilePicture: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });
            // Generate tokens
            const { accessToken, refreshToken } = (0, auth_1.generateTokens)(user.id, user.email);
            // Create user session
            await database_1.default.userSession.create({
                data: {
                    userId: user.id,
                    refreshToken,
                    deviceInfo: req.headers['user-agent'] || 'Unknown',
                    ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                },
            });
            // Create empty default wallets for core supported currencies
            const currencies = ['GHS', 'NGN', 'USD']; // Start with GHS, NGN and USD
            await Promise.all(currencies.map(currency => database_1.default.wallet.create({
                data: {
                    userId: user.id,
                    currency: currency,
                    balance: 0,
                    availableBalance: 0,
                    reservedBalance: 0,
                },
            })));
            // Transform user data to match frontend expectations
            const transformedUser = {
                id: user.id,
                email: user.email,
                name: user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.email.split('@')[0],
                phone: user.phone,
                kycStatus: user.kycStatus === 'PENDING'
                    ? 'not-started'
                    : user.kycStatus === 'IN_REVIEW'
                        ? 'pending'
                        : user.kycStatus === 'APPROVED'
                            ? 'verified'
                            : 'rejected',
                profileImage: user.profilePicture,
                createdAt: user.createdAt.toISOString(),
            };
            const loginResponse = {
                user: transformedUser,
                accessToken,
                refreshToken,
            };
            const response = {
                success: true,
                message: 'User registered successfully',
                data: loginResponse,
            };
            res.status(201).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Registration failed',
            };
            res.status(500).json(response);
        }
    }
    // User login
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            // Find user
            const user = await database_1.default.user.findUnique({
                where: { email },
            });
            if (!user) {
                const response = {
                    success: false,
                    message: 'Invalid email or password',
                };
                res.status(401).json(response);
                return;
            }
            // Verify password
            const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
            if (!isValidPassword) {
                const response = {
                    success: false,
                    message: 'Invalid email or password',
                };
                res.status(401).json(response);
                return;
            }
            // Generate tokens
            const { accessToken, refreshToken } = (0, auth_1.generateTokens)(user.id, user.email);
            // Create user session
            await database_1.default.userSession.create({
                data: {
                    userId: user.id,
                    refreshToken,
                    deviceInfo: req.headers['user-agent'] || 'Unknown',
                    ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                },
            });
            // Update last login
            await database_1.default.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });
            // Transform user data to match frontend expectations
            const transformedUser = {
                id: user.id,
                email: user.email,
                name: user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.email.split('@')[0],
                phone: user.phone,
                kycStatus: user.kycStatus === 'PENDING'
                    ? 'not-started'
                    : user.kycStatus === 'IN_REVIEW'
                        ? 'pending'
                        : user.kycStatus === 'APPROVED'
                            ? 'verified'
                            : 'rejected',
                profileImage: user.profilePicture,
                createdAt: user.createdAt.toISOString(),
            };
            const loginResponse = {
                user: transformedUser,
                accessToken,
                refreshToken,
            };
            const response = {
                success: true,
                message: 'Login successful',
                data: loginResponse,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Login failed',
            };
            res.status(500).json(response);
        }
    }
    // User logout
    static async logout(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                const response = {
                    success: false,
                    message: 'Access token required',
                };
                res.status(401).json(response);
                return;
            }
            const token = authHeader.substring(7);
            // In a production app, you might want to blacklist the token
            // For now, we'll just invalidate all user sessions
            if (req.user) {
                await database_1.default.userSession.updateMany({
                    where: { userId: req.user.id, isActive: true },
                    data: { isActive: false },
                });
            }
            const response = {
                success: true,
                message: 'Logout successful',
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Logout failed',
            };
            res.status(500).json(response);
        }
    }
    // Get user profile
    static async profile(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            const response = {
                success: true,
                message: 'Profile retrieved successfully',
                data: req.user,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve profile',
            };
            res.status(500).json(response);
        }
    }
    // Get complete account data (profile + wallets + stats + recent transactions)
    static async getAccountData(req, res) {
        try {
            if (!req.user) {
                const response = {
                    success: false,
                    message: 'User not authenticated',
                };
                res.status(401).json(response);
                return;
            }
            // Get user wallets
            const wallets = await database_1.default.wallet.findMany({
                where: {
                    userId: req.user.id,
                    isActive: true,
                },
                orderBy: { currency: 'asc' },
            });
            // Mock exchange rates
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
            const currencyInfo = {
                NGN: { flag: '🇳🇬', symbol: '₦', name: 'Nigerian Naira' },
                GBP: { flag: '🇬🇧', symbol: '£', name: 'British Pound' },
                EUR: { flag: '🇪🇺', symbol: '€', name: 'Euro' },
                KES: { flag: '🇰🇪', symbol: 'KSh', name: 'Kenyan Shilling' },
                GHS: { flag: '🇬🇭', symbol: '₵', name: 'Ghanaian Cedi' },
                ZAR: { flag: '🇿🇦', symbol: 'R', name: 'South African Rand' },
                CAD: { flag: '🇨🇦', symbol: 'C$', name: 'Canadian Dollar' },
                AUD: { flag: '🇦🇺', symbol: 'A$', name: 'Australian Dollar' },
                USD: { flag: '🇺🇸', symbol: '$', name: 'US Dollar' },
            };
            // Format wallets
            const formattedWallets = await Promise.all(wallets.map(async (wallet) => {
                const totalSent = await database_1.default.transaction.aggregate({
                    where: { walletId: wallet.id, type: 'TRANSFER_SEND', status: 'COMPLETED' },
                    _sum: { amount: true },
                });
                const totalReceived = await database_1.default.transaction.aggregate({
                    where: { walletId: wallet.id, type: 'TRANSFER_RECEIVE', status: 'COMPLETED' },
                    _sum: { amount: true },
                });
                const balance = parseFloat(wallet.balance.toString());
                const rate = exchangeRates[wallet.currency] || 1;
                const info = currencyInfo[wallet.currency];
                return {
                    flag: info?.flag || '🏳️',
                    currency: wallet.currency,
                    currencyName: info?.name || wallet.currency,
                    symbol: info?.symbol || wallet.currency,
                    balance: balance,
                    usdEquivalent: balance * rate,
                    totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
                    totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
                };
            }));
            // Get recent transactions
            const recentTransactions = await database_1.default.transaction.findMany({
                where: { userId: req.user.id },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { wallet: { select: { currency: true } } },
            });
            const formattedTransactions = recentTransactions.map(transaction => {
                const amount = parseFloat(transaction.amount.toString());
                const rate = transaction.exchangeRate
                    ? parseFloat(transaction.exchangeRate.toString())
                    : exchangeRates[transaction.currency];
                const receivedAmount = amount * rate;
                return {
                    id: transaction.id,
                    type: transaction.type === 'TRANSFER_SEND' ? 'sent' : 'received',
                    recipient: transaction.recipientName,
                    sender: transaction.recipientName,
                    amount: amount,
                    currency: transaction.currency,
                    receivedAmount: receivedAmount,
                    receivedCurrency: transaction.type === 'TRANSFER_SEND' ? 'USD' : transaction.currency,
                    status: transaction.status.toLowerCase(),
                    date: transaction.createdAt.toISOString(),
                    country: transaction.type === 'TRANSFER_SEND' ? 'United States' : 'Nigeria',
                };
            });
            // Calculate stats
            const totalSent = await database_1.default.transaction.aggregate({
                where: { userId: req.user.id, type: 'TRANSFER_SEND', status: 'COMPLETED' },
                _sum: { amount: true },
                _count: { id: true },
            });
            const totalReceived = await database_1.default.transaction.aggregate({
                where: { userId: req.user.id, type: 'TRANSFER_RECEIVE', status: 'COMPLETED' },
                _sum: { amount: true },
            });
            const activeTransfers = await database_1.default.transaction.count({
                where: { userId: req.user.id, status: { in: ['PENDING', 'PROCESSING'] } },
            });
            const savedRecipients = await database_1.default.transaction.groupBy({
                by: ['recipientName'],
                where: { userId: req.user.id, type: 'TRANSFER_SEND', recipientName: { not: null } },
            });
            const accountData = {
                user: req.user,
                wallets: formattedWallets,
                transactions: formattedTransactions,
                stats: {
                    totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
                    totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
                    activeTransfers: activeTransfers,
                    savedRecipients: savedRecipients.length,
                    totalTransactions: totalSent._count.id || 0,
                },
                totalUsdBalance: formattedWallets.reduce((sum, wallet) => sum + wallet.usdEquivalent, 0),
            };
            const response = {
                success: true,
                message: 'Account data retrieved successfully',
                data: accountData,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Failed to retrieve account data',
            };
            res.status(500).json(response);
        }
    }
    // Refresh access token
    static async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                const response = {
                    success: false,
                    message: 'Refresh token required',
                };
                res.status(401).json(response);
                return;
            }
            // Find active session with this refresh token
            const session = await database_1.default.userSession.findFirst({
                where: {
                    refreshToken,
                    isActive: true,
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            phone: true,
                            firstName: true,
                            lastName: true,
                            isEmailVerified: true,
                            isPhoneVerified: true,
                            kycStatus: true,
                            profilePicture: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },
                },
            });
            if (!session) {
                const response = {
                    success: false,
                    message: 'Invalid or expired refresh token',
                };
                res.status(401).json(response);
                return;
            }
            // Generate new tokens
            const { accessToken, refreshToken: newRefreshToken } = (0, auth_1.generateTokens)(session.user.id, session.user.email);
            // Update session with new refresh token
            await database_1.default.userSession.update({
                where: { id: session.id },
                data: { refreshToken: newRefreshToken },
            });
            // Transform user data to match frontend expectations
            const transformedUser = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.firstName && session.user.lastName
                    ? `${session.user.firstName} ${session.user.lastName}`
                    : session.user.firstName || session.user.email.split('@')[0],
                phone: session.user.phone,
                kycStatus: session.user.kycStatus === 'PENDING'
                    ? 'not-started'
                    : session.user.kycStatus === 'IN_REVIEW'
                        ? 'pending'
                        : session.user.kycStatus === 'APPROVED'
                            ? 'verified'
                            : 'rejected',
                profileImage: session.user.profilePicture,
                createdAt: session.user.createdAt.toISOString(),
            };
            const loginResponse = {
                user: transformedUser,
                accessToken,
                refreshToken: newRefreshToken,
            };
            const response = {
                success: true,
                message: 'Token refreshed successfully',
                data: loginResponse,
            };
            res.status(200).json(response);
        }
        catch (error) {
            const response = {
                success: false,
                message: 'Token refresh failed',
            };
            res.status(500).json(response);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map