import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/common';
import { ExchangeRateService } from '@/services/exchangeRateService';

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors: Record<string, string[]> = {};

      error.details.forEach(detail => {
        const field = detail.path.join('.');
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(detail.message);
      });

      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors,
      };

      return res.status(400).json(response);
    }

    next();
  };
};

// Common validation schemas
export const schemas = {
  // User registration validation
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base':
          'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
        'any.required': 'Password is required',
      }),
    firstName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'string.empty': 'First name is required',
      'any.required': 'First name is required',
    }),
    lastName: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.empty': 'Last name is required',
      'any.required': 'Last name is required',
    }),
    phone: Joi.string().pattern(new RegExp('^\\+[1-9]\\d{1,14}$')).optional().messages({
      'string.pattern.base':
        'Please provide a valid phone number in international format (e.g., +1234567890)',
    }),
  }),

  // User login validation
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
  }),

  // Password reset request validation
  passwordResetRequest: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  }),

  // Password reset validation
  passwordReset: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required',
    }),
    newPassword: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base':
          'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
        'any.required': 'New password is required',
      }),
  }),

  // Transfer creation validation
  createTransfer: Joi.object({
    amount: Joi.number().positive().precision(8).required().messages({
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required',
    }),
    sourceWallet: Joi.string()
      .valid(...ExchangeRateService.getSupportedCurrencies())
      .required()
      .messages({
        'any.only': 'Invalid source currency',
        'any.required': 'Source wallet currency is required',
      }),
    recipientCurrency: Joi.string()
      .valid(...ExchangeRateService.getSupportedCurrencies())
      .optional()
      .default('USD')
      .messages({
        'any.only': 'Invalid recipient currency',
      }),
    recipientName: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Recipient name must be at least 2 characters long',
      'string.max': 'Recipient name cannot exceed 100 characters',
      'any.required': 'Recipient name is required',
    }),
    recipientEmail: Joi.string().email().optional().messages({
      'string.email': 'Please provide a valid recipient email address',
    }),
    recipientPhone: Joi.string()
      .pattern(new RegExp('^\\+[1-9][\\d\\s-]{1,18}$'))
      .optional()
      .messages({
        'string.pattern.base':
          'Please provide a valid recipient phone number in international format',
      }),
    recipientBankName: Joi.string().min(2).max(100).optional().messages({
      'string.min': 'Bank name must be at least 2 characters long',
      'string.max': 'Bank name cannot exceed 100 characters',
    }),
    recipientAccountNumber: Joi.string().min(5).max(50).optional().messages({
      'string.min': 'Account number must be at least 5 characters long',
      'string.max': 'Account number cannot exceed 50 characters',
    }),
    recipientRoutingNumber: Joi.string()
      .length(9)
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        'string.length': 'Routing number must be exactly 9 digits',
        'string.pattern.base': 'Routing number must contain only digits',
      }),
    recipientSwiftCode: Joi.string()
      .min(8)
      .max(11)
      .pattern(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/)
      .optional()
      .messages({
        'string.min': 'SWIFT code must be at least 8 characters',
        'string.max': 'SWIFT code cannot exceed 11 characters',
        'string.pattern.base': 'Invalid SWIFT code format',
      }),
    recipientAddress: Joi.string().max(200).optional().messages({
      'string.max': 'Address cannot exceed 200 characters',
    }),
    paymentMethod: Joi.string()
      .valid('BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CRYPTO', 'ACH', 'WIRE')
      .required()
      .messages({
        'any.only': 'Invalid payment method',
        'any.required': 'Payment method is required',
      }),
    description: Joi.string().max(500).optional().messages({
      'string.max': 'Description cannot exceed 500 characters',
    }),
  }),

  // Add currency wallet validation
  addCurrencyWallet: Joi.object({
    currency: Joi.string()
      .valid(...ExchangeRateService.getSupportedCurrencies())
      .required()
      .messages({
        'any.only': 'Invalid currency code',
        'any.required': 'Currency is required',
      }),
  }),
};

// Email validation utility
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation utility
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

// Password strength validation utility
export const isStrongPassword = (password: string): boolean => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/;
  return password.length >= 8 && strongPasswordRegex.test(password);
};
