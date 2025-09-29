import { Router } from 'express';
import { AuthController } from '@/controllers/authController';
import { validate, schemas } from '@/utils/validation';
import { authenticate } from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiter';

const router = Router();

// Apply auth rate limiter to all auth routes
router.use(authLimiter);

// User registration
router.post('/register', validate(schemas.register), AuthController.register);

// User login
router.post('/login', validate(schemas.login), AuthController.login);

// User logout (requires authentication)
router.post('/logout', authenticate, AuthController.logout);

// Get user profile (requires authentication)
router.get('/profile', authenticate, AuthController.profile);

// Get complete account data (requires authentication)
router.get('/account', authenticate, AuthController.getAccountData);

// Refresh access token
router.post('/refresh', AuthController.refreshToken);

export default router;
