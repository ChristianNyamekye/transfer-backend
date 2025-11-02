import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;

  // Database
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  JWT_REFRESH_EXPIRE: string;

  // Security
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // CORS
  CORS_ORIGIN: string;

  // External APIs
  CURRENCY_API_KEY?: string;
  FLUTTERWAVE_SECRET_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;

  // Circle API
  CIRCLE_API_KEY?: string;
  CIRCLE_BASE_URL?: string;
  CIRCLE_ENVIRONMENT?: string;
  CIRCLE_GATEWAY_ENABLED?: boolean;
  CIRCLE_WEBHOOK_SECRET?: string;

  // Circle Wallet Configuration
  CIRCLE_ENTITY_SECRET?: string;
  CIRCLE_ENTITY_SECRET_ID?: string;
  CIRCLE_WALLET_SET_ID?: string;

  // Rampnow
  RAMPNOW_API_KEY?: string;
  RAMPNOW_SECRET_KEY?: string; // Secret key for HMAC signature authentication
  RAMPNOW_BASE_URL?: string;
  RAMPNOW_API_ENDPOINT?: string; // Optional: Override default endpoint path
  RAMPNOW_WEBHOOK_SECRET?: string;

  // Blockchain
  ETHEREUM_RPC_URL?: string;
  POLYGON_RPC_URL?: string;
  PRIVATE_KEY?: string;

  // Email
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASS?: string;

  // SMS
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
}

const config: Config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  API_PREFIX: process.env.API_PREFIX || '/api/v1',

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/transfer_db',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d',

  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // External APIs
  CURRENCY_API_KEY: process.env.CURRENCY_API_KEY,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,

  // Circle API
  CIRCLE_API_KEY: process.env.CIRCLE_API_KEY,
  CIRCLE_BASE_URL: process.env.CIRCLE_BASE_URL || 'https://api.circle.com',
  CIRCLE_ENVIRONMENT: process.env.CIRCLE_ENVIRONMENT || 'sandbox',
  CIRCLE_GATEWAY_ENABLED: process.env.CIRCLE_GATEWAY_ENABLED === 'true',
  CIRCLE_WEBHOOK_SECRET: process.env.CIRCLE_WEBHOOK_SECRET,

  // Circle Wallet Configuration
  CIRCLE_ENTITY_SECRET: process.env.CIRCLE_ENTITY_SECRET,
  CIRCLE_ENTITY_SECRET_ID: process.env.CIRCLE_ENTITY_SECRET_ID,
  CIRCLE_WALLET_SET_ID: process.env.CIRCLE_WALLET_SET_ID,

  // Rampnow
  // Production: https://api.rampnow.io
  // Sandbox: https://api.dev.rampnow.io
  RAMPNOW_API_KEY: process.env.RAMPNOW_API_KEY,
  RAMPNOW_SECRET_KEY: process.env.RAMPNOW_SECRET_KEY, // Secret key for HMAC signature
  RAMPNOW_BASE_URL: process.env.RAMPNOW_BASE_URL || 'https://api.dev.rampnow.io',
  RAMPNOW_API_ENDPOINT: process.env.RAMPNOW_API_ENDPOINT, // e.g., '/v1/sessions', '/api/v1/onramp', etc.
  RAMPNOW_WEBHOOK_SECRET: process.env.RAMPNOW_WEBHOOK_SECRET,

  // Blockchain
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL,
  PRIVATE_KEY: process.env.PRIVATE_KEY,

  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,

  // SMS
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
};

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];

const missingEnvVars = requiredEnvVars.filter(envVar => !config[envVar as keyof Config]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export default config;
