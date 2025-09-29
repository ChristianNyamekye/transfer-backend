"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEmailVerification = exports.requireKYC = exports.optionalAuth = exports.authenticate = exports.verifyToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const config_1 = __importDefault(require("@/config"));
const database_1 = __importDefault(require("@/lib/database"));
// Generate JWT tokens
const generateTokens = (userId, email) => {
    const accessTokenPayload = {
        userId,
        email,
        type: 'access',
    };
    const refreshTokenPayload = {
        userId,
        email,
        type: 'refresh',
    };
    const accessToken = jsonwebtoken_1.default.sign(accessTokenPayload, config_1.default.JWT_SECRET, {
        expiresIn: config_1.default.JWT_EXPIRE,
    });
    const refreshToken = jsonwebtoken_1.default.sign(refreshTokenPayload, config_1.default.JWT_SECRET, {
        expiresIn: config_1.default.JWT_REFRESH_EXPIRE,
    });
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
// Verify JWT token
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.default.JWT_SECRET);
    }
    catch (error) {
        throw new errorHandler_1.AppError('Invalid or expired token', 401);
    }
};
exports.verifyToken = verifyToken;
// Authentication middleware
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const response = {
                success: false,
                message: 'Access token required',
            };
            return res.status(401).json(response);
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const payload = (0, exports.verifyToken)(token);
        if (payload.type !== 'access') {
            const response = {
                success: false,
                message: 'Invalid token type',
            };
            return res.status(401).json(response);
        }
        // Get user from database
        const user = await database_1.default.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                kycStatus: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            const response = {
                success: false,
                message: 'User not found',
            };
            return res.status(401).json(response);
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            const response = {
                success: false,
                message: error.message,
            };
            return res.status(error.statusCode).json(response);
        }
        const response = {
            success: false,
            message: 'Authentication failed',
        };
        return res.status(401).json(response);
    }
};
exports.authenticate = authenticate;
// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.substring(7);
        const payload = (0, exports.verifyToken)(token);
        if (payload.type !== 'access') {
            return next();
        }
        const user = await database_1.default.user.findUnique({
            where: { id: payload.userId },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                kycStatus: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (user) {
            req.user = user;
        }
        next();
    }
    catch (error) {
        // Silently continue without authentication
        next();
    }
};
exports.optionalAuth = optionalAuth;
// Middleware to check if user has completed KYC
const requireKYC = (req, res, next) => {
    if (!req.user) {
        const response = {
            success: false,
            message: 'Authentication required',
        };
        return res.status(401).json(response);
    }
    if (req.user.kycStatus !== 'APPROVED') {
        const response = {
            success: false,
            message: 'KYC verification required',
            data: { kycStatus: req.user.kycStatus },
        };
        return res.status(403).json(response);
    }
    next();
};
exports.requireKYC = requireKYC;
// Middleware to check if email is verified
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        const response = {
            success: false,
            message: 'Authentication required',
        };
        return res.status(401).json(response);
    }
    if (!req.user.isEmailVerified) {
        const response = {
            success: false,
            message: 'Email verification required',
        };
        return res.status(403).json(response);
    }
    next();
};
exports.requireEmailVerification = requireEmailVerification;
//# sourceMappingURL=auth.js.map