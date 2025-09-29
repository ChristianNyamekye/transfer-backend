import rateLimit from 'express-rate-limit';
import config from '@/config';
import { ApiResponse } from '@/types/common';

// General rate limiter for all API endpoints
export const generalLimiter = rateLimit({
  windowMs: config.NODE_ENV === 'development' ? 60 * 1000 : config.RATE_LIMIT_WINDOW_MS, // 1 minute in dev, 15 minutes in prod
  max: config.NODE_ENV === 'development' ? 1000 : config.RATE_LIMIT_MAX_REQUESTS, // 1000 requests in dev, 100 in prod
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  } as ApiResponse,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiter for password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for transaction endpoints
export const transactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.NODE_ENV === 'development' ? 100 : 10, // 100 requests in dev, 10 in prod
  message: {
    success: false,
    message: 'Too many transaction requests, please slow down.',
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false,
});
