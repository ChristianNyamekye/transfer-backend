import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { JWTPayload, User } from '@/types/auth';
import { ApiResponse } from '@/types/common';
import config from '@/config';
import prisma from '@/lib/database';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Generate JWT tokens
export const generateTokens = (userId: string, email: string) => {
  const accessTokenPayload: JWTPayload = {
    userId,
    email,
    type: 'access',
  };

  const refreshTokenPayload: JWTPayload = {
    userId,
    email,
    type: 'refresh',
  };

  const accessToken = jwt.sign(accessTokenPayload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(refreshTokenPayload, config.JWT_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRE,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

// Verify JWT token
export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
};

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        message: 'Access token required',
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      const response: ApiResponse = {
        success: false,
        message: 'Invalid token type',
      };
      return res.status(401).json(response);
    }

    // Get user from database
    const user = await prisma.user.findUnique({
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
        circleCustomerId: true,
        circleKycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const response: ApiResponse = {
        success: false,
        message: 'User not found',
      };
      return res.status(401).json(response);
    }

    req.user = user as User;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      const response: ApiResponse = {
        success: false,
        message: error.message,
      };
      return res.status(error.statusCode).json(response);
    }

    const response: ApiResponse = {
      success: false,
      message: 'Authentication failed',
    };
    return res.status(401).json(response);
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      return next();
    }

    const user = await prisma.user.findUnique({
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
        circleCustomerId: true,
        circleKycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user) {
      req.user = user as User;
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Middleware to check if user has completed KYC
export const requireKYC = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentication required',
    };
    return res.status(401).json(response);
  }

  if (req.user.kycStatus !== 'APPROVED') {
    const response: ApiResponse = {
      success: false,
      message: 'KYC verification required',
      data: { kycStatus: req.user.kycStatus },
    };
    return res.status(403).json(response);
  }

  next();
};

// Middleware to check if email is verified
export const requireEmailVerification = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    const response: ApiResponse = {
      success: false,
      message: 'Authentication required',
    };
    return res.status(401).json(response);
  }

  if (!req.user.isEmailVerified) {
    const response: ApiResponse = {
      success: false,
      message: 'Email verification required',
    };
    return res.status(403).json(response);
  }

  next();
};
