import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import prisma from '@/lib/database';
import circleService from '@/services/circleService';
import config from '@/config';

export class WebhookController {
  // Handle Circle webhook events
  static async handleCircleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['circle-signature'] as string;
      const payload = JSON.stringify(req.body);

      // Verify webhook signature
      if (!circleService.verifyWebhookSignature(payload, signature)) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid webhook signature',
        };
        res.status(401).json(response);
        return;
      }

      const event = req.body;
      console.log('Circle webhook received:', {
        type: event.type,
        id: event.id,
        timestamp: event.timestamp,
      });

      // Handle different webhook event types
      switch (event.type) {
        case 'transactions.created':
        case 'transaction.created':
          await WebhookController.handleTransactionCreated(event);
          break;
        case 'transactions.confirmed':
        case 'transaction.confirmed':
          await WebhookController.handleTransactionConfirmed(event);
          break;
        case 'transactions.completed':
        case 'transaction.completed':
          await WebhookController.handleTransactionCompleted(event);
          break;
        case 'transactions.failed':
        case 'transaction.failed':
          await WebhookController.handleTransactionFailed(event);
          break;
        case 'wallets.created':
        case 'wallet.created':
          await WebhookController.handleWalletCreated(event);
          break;
        case 'users.created':
        case 'user.created':
          await WebhookController.handleUserCreated(event);
          break;
        default:
          console.log('Unhandled webhook event type:', event.type);
      }

      // Acknowledge webhook receipt
      const response: ApiResponse = {
        success: true,
        message: 'Webhook processed successfully',
        data: {
          eventType: event.type,
          eventId: event.id,
          processed: true,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Webhook processing error:', error);

      const response: ApiResponse = {
        success: false,
        message: 'Webhook processing failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };

      res.status(500).json(response);
    }
  }

  // Handle transaction created webhook
  private static async handleTransactionCreated(event: any): Promise<void> {
    const transferId = event.data?.id;
    if (!transferId) return;

    // Find transaction by Circle transfer ID
    const transaction = await prisma.transaction.findFirst({
      where: { circleTransferId: transferId },
    });

    if (transaction) {
      // Update transaction status
      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          status: 'PROCESSING',
          message: 'Circle Gateway transfer initiated',
        },
      });
    }
  }

  // Handle transaction confirmed webhook (intermediate state)
  private static async handleTransactionConfirmed(event: any): Promise<void> {
    const transferId = event.data?.id;
    if (!transferId) return;

    // Find transaction by Circle transfer ID
    const transaction = await prisma.transaction.findFirst({
      where: { circleTransferId: transferId },
    });

    if (transaction) {
      // Update transaction status to processing
      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          status: 'PROCESSING',
          message: 'Transaction confirmed on blockchain',
        },
      });
    }
  }

  // Handle transaction completed webhook
  private static async handleTransactionCompleted(event: any): Promise<void> {
    const transferId = event.data?.id;
    if (!transferId) return;

    // Find transaction by Circle transfer ID
    const transaction = await prisma.transaction.findFirst({
      where: { circleTransferId: transferId },
    });

    if (transaction) {
      // Update transaction to completed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          circleStatus: 'COMPLETED',
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

      // Complete wallet balance updates
      const wallet = await prisma.wallet.findUnique({
        where: { id: transaction.walletId },
      });

      if (wallet) {
        const totalDeduction =
          parseFloat(transaction.amount.toString()) + parseFloat(transaction.fee.toString());

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: totalDeduction },
            reservedBalance: { decrement: totalDeduction },
          },
        });
      }
    }
  }

  // Handle transaction failed webhook
  private static async handleTransactionFailed(event: any): Promise<void> {
    const transferId = event.data?.id;
    if (!transferId) return;

    // Find transaction by Circle transfer ID
    const transaction = await prisma.transaction.findFirst({
      where: { circleTransferId: transferId },
    });

    if (transaction) {
      // Update transaction to failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          circleStatus: 'FAILED',
        },
      });

      // Add failure status
      await prisma.transactionStatusHistory.create({
        data: {
          transactionId: transaction.id,
          status: 'FAILED',
          message: `Transfer failed: ${event.data?.errorMessage || 'Unknown error'}`,
        },
      });

      // Release reserved funds back to available balance
      const wallet = await prisma.wallet.findUnique({
        where: { id: transaction.walletId },
      });

      if (wallet) {
        const totalDeduction =
          parseFloat(transaction.amount.toString()) + parseFloat(transaction.fee.toString());

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: totalDeduction },
            reservedBalance: { decrement: totalDeduction },
          },
        });
      }
    }
  }

  // Handle wallet created webhook
  private static async handleWalletCreated(event: any): Promise<void> {
    console.log('Circle wallet created:', event.data);
    // Handle wallet creation events if needed
  }

  // Handle user created webhook
  private static async handleUserCreated(event: any): Promise<void> {
    console.log('Circle user created:', event.data);
    // Handle user creation events if needed for additional processing
  }

  // Handle balance updated webhook
  private static async handleBalanceUpdated(event: any): Promise<void> {
    const walletId = event.data?.walletId;
    const newBalance = event.data?.balance;

    if (walletId && newBalance) {
      // Find wallet by Circle wallet ID and update balance
      const wallet = await prisma.wallet.findFirst({
        where: { circleWalletId: walletId },
      });

      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: parseFloat(newBalance),
            availableBalance: parseFloat(newBalance),
          },
        });

        console.log(`Updated wallet balance for ${wallet.currency}:`, newBalance);
      }
    }
  }
}
