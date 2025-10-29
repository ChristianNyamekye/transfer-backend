import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import { BankAccountService } from '@/services/bankAccountService';
import prisma from '@/lib/database';
import { ExchangeRateService } from '@/services/exchangeRateService';

export class OnrampController {
  // Create onramp transfer (Bank → USDC → Wallet) - integrates with Add Funds flow
  static async createOnrampTransfer(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { bankAccountId, walletCurrency, amount } = req.body;

      // Validate bank account
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId: req.user.id,
          isActive: true,
          isVerified: true,
        },
      });

      if (!bankAccount) {
        const response: ApiResponse = {
          success: false,
          message: 'Bank account not found or not verified',
        };
        res.status(400).json(response);
        return;
      }

      // Find target wallet
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user.id,
          currency: walletCurrency,
          isActive: true,
        },
      });

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          message: 'Target wallet not found',
        };
        res.status(400).json(response);
        return;
      }

      // Determine bank account currency (for now, assume USD - in production, get from bank account)
      // In reality, the bank account would have a currency field
      const bankCurrency = 'USD'; // This should come from bankAccount.currency in production
      const targetCurrency = walletCurrency; // Currency of the wallet they're adding to
      const walletAmount = amount; // Exact amount user wants in their wallet

      // Calculate how much to charge the bank account
      let bankAmount = amount; // Amount to withdraw from bank
      let exchangeRate = 1;

      if (bankCurrency !== targetCurrency) {
        // User wants 20 EUR in EUR wallet, but bank is USD
        // Calculate: How much USD needed to get 20 EUR
        exchangeRate = await ExchangeRateService.getExchangeRate(bankCurrency, targetCurrency);
        bankAmount = amount / exchangeRate; // USD needed to get 20 EUR
      }

      const onrampFee = bankAmount * 0.01; // 1% fee on bank withdrawal amount
      const totalBankDeduction = bankAmount + onrampFee;

      console.log('Onramp calculation:', {
        userRequests: `${amount} ${targetCurrency}`,
        bankCharges: `${totalBankDeduction.toFixed(2)} ${bankCurrency}`,
        exchangeRate: `1 ${bankCurrency} = ${exchangeRate} ${targetCurrency}`,
      });

      // Create onramp transaction
      const onrampTransaction = await prisma.onrampTransaction.create({
        data: {
          userId: req.user.id,
          bankAccountId,
          walletId: wallet.id,
          amount: bankAmount, // Amount withdrawn from bank
          currency: bankCurrency, // Bank currency
          usdcAmount: bankAmount, // USDC amount (assuming 1:1 with USD for now)
          fee: onrampFee,
          exchangeRate,
          status: 'PENDING',
          description: `Add funds: ${totalBankDeduction.toFixed(2)} ${bankCurrency} → ${amount} ${targetCurrency}`,
        },
      });

      // Add initial status
      await prisma.onrampStatusHistory.create({
        data: {
          transactionId: onrampTransaction.id,
          status: 'PENDING',
          message: 'Bank transfer initiated - processing withdrawal',
        },
      });

      // For development: Simulate Circle onramp processing
      const circleTransferId = `onramp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      await prisma.onrampTransaction.update({
        where: { id: onrampTransaction.id },
        data: {
          circleTransferId,
          circleStatus: 'PROCESSING',
        },
      });

      // Add processing status
      await prisma.onrampStatusHistory.create({
        data: {
          transactionId: onrampTransaction.id,
          status: 'PROCESSING',
          message: 'Processing bank withdrawal and USDC conversion',
        },
      });

      // TEMPORARY: Development completion simulator (remove for production)
      if (process.env.NODE_ENV === 'development') {
        setTimeout(async () => {
          try {
            console.log(
              'DEVELOPMENT ONLY: Simulating onramp completion for:',
              onrampTransaction.id,
            );

            // Complete the onramp transaction
            await prisma.onrampTransaction.update({
              where: { id: onrampTransaction.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                circleStatus: 'COMPLETED',
              },
            });

            // Add completion status
            await prisma.onrampStatusHistory.create({
              data: {
                transactionId: onrampTransaction.id,
                status: 'COMPLETED',
                message: 'Funds added successfully to wallet',
              },
            });

            // Add exact amount user requested to target wallet
            await prisma.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: { increment: amount }, // Add exactly what user requested
                availableBalance: { increment: amount },
              },
            });

            console.log(
              `Added exactly ${amount} ${targetCurrency} to wallet (user requested amount)`,
            );
          } catch (error) {
            console.error('Development onramp completion failed:', error);
          }
        }, 3000); // 3 second delay for development
      }

      const response: ApiResponse = {
        success: true,
        message: 'Onramp transfer initiated successfully',
        data: {
          transactionId: onrampTransaction.id,
          reference: onrampTransaction.reference,
          status: 'PENDING',
          bankDeduction: {
            amount: totalBankDeduction.toFixed(2),
            currency: bankCurrency,
            breakdown: {
              principal: bankAmount.toFixed(2),
              fee: onrampFee.toFixed(2),
            },
          },
          walletCredit: {
            amount: amount,
            currency: targetCurrency,
          },
          exchangeRate: `1 ${bankCurrency} = ${exchangeRate.toFixed(4)} ${targetCurrency}`,
          bankAccount: {
            bankName: bankAccount.bankName,
            accountNumber: `****${bankAccount.accountNumber.slice(-4)}`,
          },
          estimatedCompletion: '1-3 business days',
          createdAt: onrampTransaction.createdAt,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create onramp transfer',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Get onramp transactions for user
  static async getOnrampTransactions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { page = 1, limit = 10 } = req.query;

      const transactions = await prisma.onrampTransaction.findMany({
        where: { userId: req.user.id },
        include: {
          bankAccount: {
            select: {
              bankName: true,
              accountNumber: true,
            },
          },
          wallet: {
            select: {
              currency: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      });

      const total = await prisma.onrampTransaction.count({
        where: { userId: req.user.id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Onramp transactions retrieved successfully',
        data: {
          transactions: transactions.map(tx => ({
            id: tx.id,
            reference: tx.reference,
            status: tx.status,
            amount: parseFloat(tx.amount.toString()),
            currency: tx.currency,
            targetAmount:
              parseFloat(tx.usdcAmount.toString()) * parseFloat(tx.exchangeRate.toString()),
            targetCurrency: tx.wallet.currency,
            bankAccount: {
              bankName: tx.bankAccount.bankName,
              accountNumber: `****${tx.bankAccount.accountNumber.slice(-4)}`,
            },
            createdAt: tx.createdAt,
            completedAt: tx.completedAt,
          })),
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve onramp transactions',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }
}
