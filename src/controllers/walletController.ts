import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import prisma from '@/lib/database';
import { ExchangeRateService } from '@/services/exchangeRateService';

export class WalletController {
  // Get user wallets in the format expected by frontend
  static async getUserWallets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      // Get user wallets with current exchange rates
      const wallets = await prisma.wallet.findMany({
        where: {
          userId: req.user.id,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Get real-time exchange rates from API
      const exchangeRates = await ExchangeRateService.getExchangeRates('USD');

      // Calculate total sent and received for each wallet
      const walletsWithStats = await Promise.all(
        wallets.map(async (wallet: any) => {
          const totalSent = await prisma.transaction.aggregate({
            where: {
              walletId: wallet.id,
              type: 'TRANSFER_SEND',
              status: 'COMPLETED',
            },
            _sum: { amount: true },
          });

          const totalReceived = await prisma.transaction.aggregate({
            where: {
              walletId: wallet.id,
              type: 'TRANSFER_RECEIVE',
              status: 'COMPLETED',
            },
            _sum: { amount: true },
          });

          const balance = parseFloat(wallet.balance.toString());
          const info = ExchangeRateService.getCurrencyInfo(wallet.currency);

          // Calculate USD equivalent using the exchange rate service
          const exchangeRate = await ExchangeRateService.getExchangeRate(wallet.currency, 'USD');
          const usdEquivalent = wallet.currency === 'USD' ? balance : balance * exchangeRate;

          return {
            flag: info.flag,
            currency: wallet.currency,
            currencyName: info.name,
            symbol: info.symbol,
            balance: balance,
            usdEquivalent: parseFloat(usdEquivalent.toFixed(2)),
            totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
            totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
          };
        }),
      );

      const response: ApiResponse = {
        success: true,
        message: 'Wallets retrieved successfully',
        data: walletsWithStats,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve wallets',
      };
      res.status(500).json(response);
    }
  }

  // Get wallet statistics for dashboard
  static async getWalletStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      // Get all user wallets
      const wallets = await prisma.wallet.findMany({
        where: {
          userId: req.user.id,
          isActive: true,
        },
      });

      // Calculate total sent across all wallets
      const totalSent = await prisma.transaction.aggregate({
        where: {
          userId: req.user.id,
          type: 'TRANSFER_SEND',
          status: 'COMPLETED',
        },
        _sum: { amount: true },
        _count: { id: true },
      });

      // Calculate total received across all wallets
      const totalReceived = await prisma.transaction.aggregate({
        where: {
          userId: req.user.id,
          type: 'TRANSFER_RECEIVE',
          status: 'COMPLETED',
        },
        _sum: { amount: true },
      });

      // Count active transfers
      const activeTransfers = await prisma.transaction.count({
        where: {
          userId: req.user.id,
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
        },
      });

      // Count saved recipients (unique recipient names from completed transfers)
      const savedRecipients = await prisma.transaction.groupBy({
        by: ['recipientName'],
        where: {
          userId: req.user.id,
          type: 'TRANSFER_SEND',
          recipientName: { not: null },
        },
      });

      const stats = {
        totalSent: parseFloat(totalSent._sum.amount?.toString() || '0'),
        totalReceived: parseFloat(totalReceived._sum.amount?.toString() || '0'),
        activeTransfers: activeTransfers,
        savedRecipients: savedRecipients.length,
        totalTransactions: totalSent._count.id || 0,
      };

      const response: ApiResponse = {
        success: true,
        message: 'Wallet statistics retrieved successfully',
        data: stats,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve wallet statistics',
      };
      res.status(500).json(response);
    }
  }

  // Add new currency wallet
  static async addCurrencyWallet(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { currency } = req.body;

      // Check if wallet already exists
      const existingWallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user.id,
          currency: currency,
        },
      });

      if (existingWallet) {
        const response: ApiResponse = {
          success: false,
          message: `${currency} wallet already exists`,
        };
        res.status(409).json(response);
        return;
      }

      // Create new wallet
      const wallet = await prisma.wallet.create({
        data: {
          userId: req.user.id,
          currency: currency,
          balance: 0,
          availableBalance: 0,
          reservedBalance: 0,
        },
      });

      const response: ApiResponse = {
        success: true,
        message: `${currency} wallet created successfully`,
        data: {
          id: wallet.id,
          currency: wallet.currency,
          balance: parseFloat(wallet.balance.toString()),
          availableBalance: parseFloat(wallet.availableBalance.toString()),
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create wallet',
      };
      res.status(500).json(response);
    }
  }

  // Add funds to wallet (for testing - in production this would be through payment processing)
  static async addFunds(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { currency, amount } = req.body;

      if (!currency || !amount || amount <= 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Currency and positive amount are required',
        };
        res.status(400).json(response);
        return;
      }

      // Find the wallet
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user.id,
          currency: currency,
          isActive: true,
        },
      });

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          message: 'Wallet not found',
        };
        res.status(404).json(response);
        return;
      }

      // Update wallet balance
      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
          availableBalance: {
            increment: amount,
          },
        },
      });

      // Create transaction record
      await prisma.transaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amount: amount,
          currency: currency,
          fee: 0,
          description: 'Test deposit',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: `${currency} ${amount} added to wallet successfully`,
        data: {
          currency: currency,
          newBalance: parseFloat(updatedWallet.balance.toString()),
          amountAdded: amount,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to add funds',
      };
      res.status(500).json(response);
    }
  }
}
