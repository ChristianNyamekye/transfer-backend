"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("@/controllers/authController");
const validation_1 = require("@/utils/validation");
const auth_1 = require("@/middleware/auth");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const router = (0, express_1.Router)();
// Apply auth rate limiter to all auth routes
router.use(rateLimiter_1.authLimiter);
// User registration
router.post('/register', (0, validation_1.validate)(validation_1.schemas.register), authController_1.AuthController.register);
// User login
router.post('/login', (0, validation_1.validate)(validation_1.schemas.login), authController_1.AuthController.login);
// User logout (requires authentication)
router.post('/logout', auth_1.authenticate, authController_1.AuthController.logout);
// Get user profile (requires authentication)
router.get('/profile', auth_1.authenticate, authController_1.AuthController.profile);
// Get complete account data (requires authentication)
router.get('/account', auth_1.authenticate, authController_1.AuthController.getAccountData);
// Refresh access token
router.post('/refresh', authController_1.AuthController.refreshToken);
exports.default = router;
//# sourceMappingURL=auth.js.map