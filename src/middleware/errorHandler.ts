import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@/types/common';
import config from '@/config';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  let error = { ...err } as AppError;
  error.message = err.message;

  // Log error in development only
  if (config.NODE_ENV === 'development') {
    console.error(`Error: ${err.message}`, err.stack);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message);
    error = new AppError(message.join(', '), 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  const response: ApiResponse = {
    success: false,
    message: error.message || 'Internal Server Error',
    ...(config.NODE_ENV === 'development' && { error: err.stack }),
  };

  res.status(error.statusCode || 500).json(response);
};
