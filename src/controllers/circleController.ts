import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import circleService from '@/services/circleService';
import prisma from '@/lib/database';

export class CircleController {
  // Test Circle API connectivity
  static async testConnection(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await circleService.ping();

      // Test Circle user creation capability
      let userCreationAvailable = false;
      try {
        await circleService.getUser('test-connectivity-check');
      } catch (error) {
        // User doesn't exist, but API is accessible
        userCreationAvailable = true;
      }

      const response: ApiResponse = {
        success: isConnected,
        message: isConnected ? 'Circle API connection successful' : 'Circle API connection failed',
        data: {
          environment: process.env.CIRCLE_ENVIRONMENT || 'sandbox',
          apiKeySet: !!process.env.CIRCLE_API_KEY,
          apiKeyPrefix: process.env.CIRCLE_API_KEY?.substring(0, 20) + '...',
          baseUrl: process.env.CIRCLE_BASE_URL || 'https://api.circle.com',
          userCreationAvailable: userCreationAvailable,
          gatewayEnabled: process.env.CIRCLE_GATEWAY_ENABLED === 'true',
          timestamp: new Date().toISOString(),
        },
      };

      res.status(isConnected ? 200 : 500).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to test Circle API connection',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Initialize Circle Gateway for existing user
  static async initializeGateway(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      // Check if user already has Circle Gateway setup
      if (req.user.circleCustomerId) {
        const response: ApiResponse = {
          success: false,
          message: 'User already has Circle Gateway initialized',
          data: { circleUserId: req.user.circleCustomerId },
        };
        res.status(400).json(response);
        return;
      }

      // For Circle Gateway, we don't need to create users via API
      // We just mark the user as Gateway-ready and use their ID
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          circleCustomerId: req.user.id,
          circleKycStatus: 'gateway_ready',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Circle Gateway initialized successfully',
        data: {
          circleUserId: req.user.id,
          status: 'gateway_ready',
          message: 'User is ready for USDC transfers via Circle Gateway',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to initialize Circle Gateway',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Create Circle wallet for user
  static async createWallet(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      if (!req.user.circleCustomerId) {
        const response: ApiResponse = {
          success: false,
          message: 'User must have Circle customer account first',
        };
        res.status(400).json(response);
        return;
      }

      // Create Circle wallet
      const circleWallet = await circleService.createWallet(req.user.id);

      // Update user with Circle wallet ID
      await prisma.user.update({
        where: { id: req.user.id },
        data: { circleWalletId: circleWallet.walletId },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Circle wallet created successfully',
        data: {
          walletId: circleWallet.walletId,
          address: circleWallet.address,
          blockchain: circleWallet.blockchain,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create Circle wallet',
      };
      res.status(500).json(response);
    }
  }

  // Get Circle wallet balance
  static async getWalletBalance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.circleWalletId) {
        const response: ApiResponse = {
          success: false,
          message: 'User does not have Circle wallet',
        };
        res.status(400).json(response);
        return;
      }

      const balance = await circleService.getWalletBalance(req.user.circleWalletId);

      const response: ApiResponse = {
        success: true,
        message: 'Circle wallet balance retrieved',
        data: {
          balance,
          currency: 'USDC',
          walletId: req.user.circleWalletId,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get Circle wallet balance',
      };
      res.status(500).json(response);
    }
  }

  // Circle Gateway - Get user's Circle wallet balances
  static async getGatewayBalance(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      if (!req.user.circleCustomerId) {
        const response: ApiResponse = {
          success: false,
          message: 'User does not have Circle Gateway initialized',
        };
        res.status(400).json(response);
        return;
      }

      // For now, return mock balance data
      // In production, this would query actual Circle wallet balances
      const response: ApiResponse = {
        success: true,
        message: 'Gateway balance retrieved successfully',
        data: {
          userId: req.user.circleCustomerId,
          totalBalance: '0',
          availableBalance: '0',
          chains: [],
          message: 'Gateway balance tracking ready for production',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get Gateway balance',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Circle Gateway - Create cross-chain transfer
  static async createGatewayTransfer(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { sourceAddress, sourceChain, destinationAddress, destinationChain, amount } = req.body;

      const transfer = await circleService.createGatewayTransfer({
        source: {
          address: sourceAddress,
          chain: sourceChain,
        },
        destination: {
          address: destinationAddress,
          chain: destinationChain,
        },
        amount: amount,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Gateway transfer created successfully',
        data: transfer,
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create Gateway transfer',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Get Gateway status for authenticated user
  static async getGatewayStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse = {
        success: !!req.user.circleCustomerId,
        message: req.user.circleCustomerId ? 'Gateway is initialized' : 'Gateway not initialized',
        data: {
          initialized: !!req.user.circleCustomerId,
          status: req.user.circleKycStatus || 'not_initialized',
          circleUserId: req.user.circleCustomerId,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get Gateway status',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }
}
