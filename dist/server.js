"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = __importDefault(require("@/config"));
const errorHandler_1 = require("@/middleware/errorHandler");
const notFound_1 = require("@/middleware/notFound");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const auth_1 = __importDefault(require("@/routes/auth"));
const wallet_1 = __importDefault(require("@/routes/wallet"));
const transaction_1 = __importDefault(require("@/routes/transaction"));
const exchangeRate_1 = __importDefault(require("@/routes/exchangeRate"));
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
app.use(rateLimiter_1.generalLimiter);
app.use((0, cors_1.default)({
    origin: [config_1.default.CORS_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080', 'file://'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
// Logging middleware
if (config_1.default.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)('combined'));
}
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: config_1.default.NODE_ENV,
        version: '1.0.0',
    });
});
// API routes
app.use(`${config_1.default.API_PREFIX}/auth`, auth_1.default);
app.use(`${config_1.default.API_PREFIX}/wallets`, wallet_1.default);
app.use(`${config_1.default.API_PREFIX}/transactions`, transaction_1.default);
app.use(`${config_1.default.API_PREFIX}/exchange-rates`, exchangeRate_1.default);
// Error handling middleware (must be last)
app.use(notFound_1.notFound);
app.use(errorHandler_1.errorHandler);
const server = app.listen(config_1.default.PORT, () => {
    console.log(`Server running on port ${config_1.default.PORT} in ${config_1.default.NODE_ENV} mode`);
    console.log(`API documentation available at http://localhost:${config_1.default.PORT}${config_1.default.API_PREFIX}`);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=server.js.map