import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import prisma from '@/lib/database';
import { ExchangeRateService } from '@/services/exchangeRateService';

export class TransactionController {
  // Get user transactions in the format expected by frontend
  static async getUserTransactions(req: Request, res: Response): Promise<void> {
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
      const skip = (Number(page) - 1) * Number(limit);

      const transactions = await prisma.transaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          wallet: {
            select: { currency: true },
          },
        },
      });

      // Mock exchange rates for conversion display
      const exchangeRates: Record<string, number> = {
        NGN: 0.00067,
        GBP: 1.27,
        EUR: 1.09,
        KES: 0.0064,
        GHS: 0.065,
        ZAR: 0.054,
        CAD: 0.74,
        AUD: 0.66,
        USD: 1.0,
      };

      // Transform transactions to match frontend format
      const formattedTransactions = transactions.map(transaction => {
        const amount = parseFloat(transaction.amount.toString());
        const rate = transaction.exchangeRate
          ? parseFloat(transaction.exchangeRate.toString())
          : exchangeRates[transaction.currency];
        const receivedAmount = amount * rate;

        return {
          id: transaction.id,
          type: transaction.type === 'TRANSFER_SEND' ? ('sent' as const) : ('received' as const),
          recipient: transaction.recipientName,
          sender: transaction.recipientName, // For received transactions, this would be the sender
          amount: amount,
          currency: transaction.currency,
          receivedAmount: receivedAmount,
          receivedCurrency: transaction.type === 'TRANSFER_SEND' ? 'USD' : transaction.currency,
          status: transaction.status.toLowerCase() as 'completed' | 'processing' | 'failed',
          date: transaction.createdAt.toISOString(),
          country: transaction.type === 'TRANSFER_SEND' ? 'United States' : 'Nigeria', // Mock country
        };
      });

      const response: ApiResponse = {
        success: true,
        message: 'Transactions retrieved successfully',
        data: formattedTransactions,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve transactions',
      };
      res.status(500).json(response);
    }
  }

  // Create a new money transfer
  static async createTransfer(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const {
        amount,
        sourceWallet,
        recipientCurrency = 'USD', // Default to USD for international transfers
        recipientName,
        recipientEmail,
        recipientPhone,
        recipientBankName,
        recipientAccountNumber,
        recipientRoutingNumber,
        recipientSwiftCode,
        recipientAddress,
        paymentMethod,
        description,
      } = req.body;

      // Find the source wallet
      const wallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user.id,
          currency: sourceWallet,
          isActive: true,
        },
      });

      if (!wallet) {
        const response: ApiResponse = {
          success: false,
          message: 'Source wallet not found',
        };
        res.status(404).json(response);
        return;
      }

      // Calculate fees and exchange rate
      const feePercentage = 0.015; // 1.5% transfer fee
      const transferFee = amount * feePercentage;
      const totalDeduction = amount + transferFee;

      // Check if user has sufficient balance including fees
      const availableBalance = parseFloat(wallet.availableBalance.toString());
      if (availableBalance < totalDeduction) {
        const response: ApiResponse = {
          success: false,
          message: `Insufficient balance. You need ${sourceWallet} ${totalDeduction.toLocaleString()} (including ${feePercentage * 100}% fee) but only have ${sourceWallet} ${availableBalance.toLocaleString()}`,
        };
        res.status(400).json(response);
        return;
      }

      // Get current exchange rate for conversion
      const exchangeRate = await ExchangeRateService.getExchangeRate(
        sourceWallet,
        recipientCurrency,
      );
      const recipientAmount = sourceWallet === recipientCurrency ? amount : amount * exchangeRate;

      // Create the transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId: req.user.id,
          walletId: wallet.id,
          type: 'TRANSFER_SEND',
          status: 'PENDING',
          amount: amount,
          currency: sourceWallet,
          fee: transferFee,
          exchangeRate: exchangeRate,
          recipientName,
          recipientEmail,
          recipientPhone,
          recipientBankName,
          recipientAccountNumber,
          recipientRoutingNumber,
          recipientSwiftCode,
          recipientAddress,
          paymentMethod: paymentMethod?.toUpperCase(),
          description: description || `Transfer to ${recipientName}`,
        },
      });

      // Reserve funds in wallet (deduct from available, add to reserved)
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: {
            decrement: totalDeduction,
          },
          reservedBalance: {
            increment: totalDeduction,
          },
        },
      });

      // Create initial transaction status
      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          status: 'PENDING',
          message: 'Transfer initiated - validating recipient details',
        },
      });

      // For demo purposes, auto-complete the transaction after a short delay
      // In production, this would be handled by payment processors/background jobs
      setTimeout(async () => {
        try {
          // Update transaction to completed
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });

          // Add completion status
          await prisma.transactionStatusHistory.create({
            data: {
              transactionId: transaction.id,
              status: 'COMPLETED',
              message: 'Transfer completed successfully',
            },
          });

          // Move reserved funds to completed (deduct from balance and reserved)
          const wallet = await prisma.wallet.findUnique({ where: { id: transaction.walletId } });
          if (wallet) {
            await prisma.wallet.update({
              where: { id: wallet.id },
              data: {
                balance: {
                  decrement: totalDeduction,
                },
                reservedBalance: {
                  decrement: totalDeduction,
                },
              },
            });
          }
        } catch (error) {
          // Handle completion error silently
        }
      }, 3000); // Complete after 3 seconds

      // Return transaction details with fee breakdown
      const response: ApiResponse = {
        success: true,
        message: 'Transfer initiated successfully',
        data: {
          transactionId: transaction.id,
          reference: transaction.reference,
          status: transaction.status,
          breakdown: {
            sendAmount: amount,
            transferFee: transferFee,
            totalDeducted: totalDeduction,
            exchangeRate: exchangeRate,
            recipientReceives: parseFloat(recipientAmount.toFixed(2)),
            recipientCurrency,
          },
          recipient: {
            name: recipientName,
            email: recipientEmail,
            bankName: recipientBankName,
            accountNumber: recipientAccountNumber,
          },
          estimatedDelivery: '5-10 minutes',
          createdAt: transaction.createdAt.toISOString(),
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to create transfer',
      };
      res.status(500).json(response);
    }
  }

  // Get transaction by ID
  static async getTransactionById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;

      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          userId: req.user.id,
        },
        include: {
          wallet: {
            select: { currency: true },
          },
          statusHistory: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!transaction) {
        const response: ApiResponse = {
          success: false,
          message: 'Transaction not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Transaction retrieved successfully',
        data: {
          id: transaction.id,
          reference: transaction.reference,
          type: transaction.type,
          status: transaction.status,
          amount: parseFloat(transaction.amount.toString()),
          currency: transaction.currency,
          fee: parseFloat(transaction.fee.toString()),
          recipientName: transaction.recipientName,
          recipientEmail: transaction.recipientEmail,
          recipientBankName: transaction.recipientBankName,
          recipientAccountNumber: transaction.recipientAccountNumber,
          paymentMethod: transaction.paymentMethod,
          description: transaction.description,
          createdAt: transaction.createdAt.toISOString(),
          completedAt: transaction.completedAt?.toISOString(),
          statusHistory: transaction.statusHistory.map(history => ({
            status: history.status,
            message: history.message,
            createdAt: history.createdAt.toISOString(),
          })),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve transaction',
      };
      res.status(500).json(response);
    }
  }

  // Calculate transfer fees and conversion
  static async calculateTransferFees(req: Request, res: Response): Promise<void> {
    try {
      const { amount, fromCurrency, toCurrency = 'USD' } = req.query;

      if (!amount || !fromCurrency) {
        const response: ApiResponse = {
          success: false,
          message: 'Amount and fromCurrency are required',
        };
        res.status(400).json(response);
        return;
      }

      const sendAmount = parseFloat(amount as string);
      const feePercentage = 0.015; // 1.5% transfer fee
      const transferFee = sendAmount * feePercentage;
      const totalCost = sendAmount + transferFee;

      // Get current exchange rate using the exchange rate service
      const exchangeRate = await ExchangeRateService.getExchangeRate(
        fromCurrency as string,
        toCurrency as string,
      );
      // For NGN to USD: if rate is 0.000673, then 1 NGN = 0.000673 USD
      // So 1,000,000 NGN = 1,000,000 * 0.000673 = 673 USD
      const recipientAmount = fromCurrency === toCurrency ? sendAmount : sendAmount * exchangeRate;

      const response: ApiResponse = {
        success: true,
        message: 'Transfer fees calculated successfully',
        data: {
          sendAmount: sendAmount,
          transferFee: parseFloat(transferFee.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          exchangeRate: exchangeRate,
          recipientReceives: parseFloat(recipientAmount.toFixed(2)),
          recipientCurrency: toCurrency,
          feePercentage: feePercentage * 100,
          estimatedDelivery: '5-10 minutes',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to calculate transfer fees',
      };
      res.status(500).json(response);
    }
  }

  // Update transaction status (for processing pipeline)
  static async updateTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      const { status, message } = req.body;

      // Find transaction
      const transaction = await prisma.transaction.findFirst({
        where: {
          id,
          userId: req.user.id,
        },
      });

      if (!transaction) {
        const response: ApiResponse = {
          success: false,
          message: 'Transaction not found',
        };
        res.status(404).json(response);
        return;
      }

      // Update transaction status
      const updatedTransaction = await prisma.transaction.update({
        where: { id },
        data: {
          status: status.toUpperCase(),
          ...(status.toUpperCase() === 'COMPLETED' && { completedAt: new Date() }),
        },
      });

      // Add status history
      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          status: status.toUpperCase(),
          message: message || `Transaction ${status.toLowerCase()}`,
        },
      });

      // If completed, move reserved funds to completed
      if (status.toUpperCase() === 'COMPLETED') {
        const wallet = await prisma.wallet.findUnique({ where: { id: transaction.walletId } });
        if (wallet) {
          const totalDeduction =
            parseFloat(transaction.amount.toString()) + parseFloat(transaction.fee.toString());

          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: {
                decrement: totalDeduction,
              },
              reservedBalance: {
                decrement: totalDeduction,
              },
            },
          });
        }
      }

      const response: ApiResponse = {
        success: true,
        message: 'Transaction status updated successfully',
        data: {
          id: updatedTransaction.id,
          status: updatedTransaction.status,
          completedAt: updatedTransaction.completedAt?.toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to update transaction status',
      };
      res.status(500).json(response);
    }
  }
}
