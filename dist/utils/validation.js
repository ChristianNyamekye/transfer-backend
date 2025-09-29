"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStrongPassword = exports.isValidPhone = exports.isValidEmail = exports.schemas = exports.validate = void 0;
const joi_1 = __importDefault(require("joi"));
// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = {};
            error.details.forEach(detail => {
                const field = detail.path.join('.');
                if (!errors[field]) {
                    errors[field] = [];
                }
                errors[field].push(detail.message);
            });
            const response = {
                success: false,
                message: 'Validation failed',
                errors,
            };
            return res.status(400).json(response);
        }
        next();
    };
};
exports.validate = validate;
// Common validation schemas
exports.schemas = {
    // User registration validation
    register: joi_1.default.object({
        email: joi_1.default.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
        password: joi_1.default.string()
            .min(8)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
            'any.required': 'Password is required',
        }),
        firstName: joi_1.default.string().min(2).max(50).required().messages({
            'string.min': 'First name must be at least 2 characters long',
            'string.max': 'First name cannot exceed 50 characters',
            'string.empty': 'First name is required',
            'any.required': 'First name is required',
        }),
        lastName: joi_1.default.string().min(2).max(50).required().messages({
            'string.min': 'Last name must be at least 2 characters long',
            'string.max': 'Last name cannot exceed 50 characters',
            'string.empty': 'Last name is required',
            'any.required': 'Last name is required',
        }),
        phone: joi_1.default.string().pattern(new RegExp('^\\+[1-9]\\d{1,14}$')).optional().messages({
            'string.pattern.base': 'Please provide a valid phone number in international format (e.g., +1234567890)',
        }),
    }),
    // User login validation
    login: joi_1.default.object({
        email: joi_1.default.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
        password: joi_1.default.string().required().messages({
            'any.required': 'Password is required',
        }),
    }),
    // Password reset request validation
    passwordResetRequest: joi_1.default.object({
        email: joi_1.default.string().email().required().messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
    }),
    // Password reset validation
    passwordReset: joi_1.default.object({
        token: joi_1.default.string().required().messages({
            'any.required': 'Reset token is required',
        }),
        newPassword: joi_1.default.string()
            .min(8)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character',
            'any.required': 'New password is required',
        }),
    }),
    // Transfer creation validation
    createTransfer: joi_1.default.object({
        amount: joi_1.default.number().positive().precision(8).required().messages({
            'number.positive': 'Amount must be positive',
            'any.required': 'Amount is required',
        }),
        currency: joi_1.default.string()
            .valid('USD', 'NGN', 'KES', 'GHS', 'ZAR', 'GBP', 'EUR', 'CAD', 'AUD')
            .required()
            .messages({
            'any.only': 'Invalid currency',
            'any.required': 'Currency is required',
        }),
        recipientName: joi_1.default.string().min(2).max(100).required().messages({
            'string.min': 'Recipient name must be at least 2 characters long',
            'string.max': 'Recipient name cannot exceed 100 characters',
            'any.required': 'Recipient name is required',
        }),
        recipientEmail: joi_1.default.string().email().optional().messages({
            'string.email': 'Please provide a valid recipient email address',
        }),
        recipientPhone: joi_1.default.string().pattern(new RegExp('^\\+[1-9]\\d{1,14}$')).optional().messages({
            'string.pattern.base': 'Please provide a valid recipient phone number in international format',
        }),
        recipientBankName: joi_1.default.string().min(2).max(100).optional().messages({
            'string.min': 'Bank name must be at least 2 characters long',
            'string.max': 'Bank name cannot exceed 100 characters',
        }),
        recipientAccountNumber: joi_1.default.string().min(5).max(50).optional().messages({
            'string.min': 'Account number must be at least 5 characters long',
            'string.max': 'Account number cannot exceed 50 characters',
        }),
        recipientRoutingNumber: joi_1.default.string()
            .length(9)
            .pattern(/^[0-9]+$/)
            .optional()
            .messages({
            'string.length': 'Routing number must be exactly 9 digits',
            'string.pattern.base': 'Routing number must contain only digits',
        }),
        paymentMethod: joi_1.default.string()
            .valid('BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CRYPTO', 'ACH', 'WIRE')
            .required()
            .messages({
            'any.only': 'Invalid payment method',
            'any.required': 'Payment method is required',
        }),
        description: joi_1.default.string().max(500).optional().messages({
            'string.max': 'Description cannot exceed 500 characters',
        }),
    }),
    // Add currency wallet validation
    addCurrencyWallet: joi_1.default.object({
        currency: joi_1.default.string()
            .valid('USD', 'NGN', 'KES', 'GHS', 'ZAR', 'GBP', 'EUR', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'BRL', 'MXN', 'SGD', 'HKD', 'NZD', 'SEK', 'NOK', 'KRW', 'THB', 'PHP', 'IDR', 'MYR', 'EGP', 'MAD', 'TND', 'ETB', 'UGX', 'TZS', 'XOF', 'XAF', 'RWF', 'MZN', 'AED', 'SAR')
            .required()
            .messages({
            'any.only': 'Invalid currency code',
            'any.required': 'Currency is required',
        }),
    }),
};
// Email validation utility
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
// Phone validation utility
const isValidPhone = (phone) => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};
exports.isValidPhone = isValidPhone;
// Password strength validation utility
const isStrongPassword = (password) => {
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/;
    return password.length >= 8 && strongPasswordRegex.test(password);
};
exports.isStrongPassword = isStrongPassword;
//# sourceMappingURL=validation.js.map