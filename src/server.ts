import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config from '@/config';
import { errorHandler } from '@/middleware/errorHandler';
import { notFound } from '@/middleware/notFound';
import { generalLimiter } from '@/middleware/rateLimiter';
import authRoutes from '@/routes/auth';
import walletRoutes from '@/routes/wallet';
import transactionRoutes from '@/routes/transaction';
import exchangeRateRoutes from '@/routes/exchangeRate';

const app = express();

// Security middleware
app.use(helmet());
app.use(generalLimiter);
app.use(
  cors({
    origin: [config.CORS_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080', 'file://'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

// Logging middleware
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '1.0.0',
  });
});

// API routes
app.use(`${config.API_PREFIX}/auth`, authRoutes);
app.use(`${config.API_PREFIX}/wallets`, walletRoutes);
app.use(`${config.API_PREFIX}/transactions`, transactionRoutes);
app.use(`${config.API_PREFIX}/exchange-rates`, exchangeRateRoutes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT} in ${config.NODE_ENV} mode`);
  console.log(`API documentation available at http://localhost:${config.PORT}${config.API_PREFIX}`);
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

export default app;
