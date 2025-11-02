import { Request, Response } from 'express';
import prisma from '@/lib/database';
import { ApiResponse } from '@/types/common';
import { RampnowService } from '@/services/rampnowService';

export class RampnowWebhookController {
  static async handle(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.header('x-rampnow-signature') || req.header('x-signature');
      const rawBody = JSON.stringify(req.body);

      const verified = RampnowService.verifyWebhookSignature(rawBody, signature || undefined);
      if (!verified) {
        res
          .status(401)
          .json({ success: false, message: 'Invalid webhook signature' } as ApiResponse);
        return;
      }

      const event = req.body;
      const type: string = event?.type || event?.event;
      const data = event?.data || event;

      // Expect session/order id and status
      const sessionId: string | undefined = data?.id || data?.sessionId;
      const status: string | undefined = data?.status;

      if (!sessionId) {
        res.status(400).json({ success: false, message: 'Missing session id' } as ApiResponse);
        return;
      }

      // Find onramp transaction by stored provider id (reused circleTransferId field)
      const tx = await prisma.onrampTransaction.findFirst({
        where: { circleTransferId: sessionId },
      });

      if (!tx) {
        res.status(200).json({ success: true, message: 'No matching transaction; ignored' });
        return;
      }

      // Persist status change
      if (status) {
        await prisma.onrampTransaction.update({
          where: { id: tx.id },
          data: { circleStatus: status },
        });
        await prisma.onrampStatusHistory.create({
          data: {
            transactionId: tx.id,
            status:
              status === 'completed' ? 'COMPLETED' : status === 'failed' ? 'FAILED' : 'PROCESSING',
            message: `Rampnow status: ${status}`,
            metadata: { type, payload: data },
          },
        });

        if (status === 'completed') {
          // Rampnow sends USDC, which is stored in a USDC wallet
          // We need to convert USDC to the target currency and credit the target wallet
          const targetWallet = await prisma.wallet.findUnique({ where: { id: tx.walletId } });
          const metadata = tx.description ? JSON.parse(tx.description) : {};

          if (!targetWallet) {
            console.error(`Target wallet ${tx.walletId} not found for onramp transaction ${tx.id}`);
            res.status(200).json({ success: true, message: 'Target wallet not found' });
            return;
          }

          // Get the USDC amount received (from webhook data or transaction record)
          const usdcAmountReceived = Number(
            data?.cryptoAmount || data?.amount || tx.usdcAmount.toString(),
          );

          // If target wallet is USDC, credit directly
          if (targetWallet.currency === 'USDC') {
            await prisma.wallet.update({
              where: { id: targetWallet.id },
              data: {
                balance: { increment: usdcAmountReceived },
                availableBalance: { increment: usdcAmountReceived },
              },
            });
          } else {
            // Convert USDC to target currency using exchange rate
            const { ExchangeRateService } = await import('@/services/exchangeRateService');
            const usdcToTargetRate = await ExchangeRateService.getExchangeRate(
              'USDC',
              targetWallet.currency,
            );
            const targetAmount = usdcAmountReceived * usdcToTargetRate;

            // Credit target wallet
            await prisma.wallet.update({
              where: { id: targetWallet.id },
              data: {
                balance: { increment: targetAmount },
                availableBalance: { increment: targetAmount },
              },
            });
          }

          await prisma.onrampTransaction.update({
            where: { id: tx.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              usdcAmount: usdcAmountReceived, // Update with actual received amount
            },
          });
        } else if (status === 'failed') {
          await prisma.onrampTransaction.update({
            where: { id: tx.id },
            data: { status: 'FAILED' },
          });
        }
      }

      res.status(200).json({ success: true } as ApiResponse);
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          message: 'Webhook handling failed',
          data: { error: (error as Error).message },
        } as ApiResponse);
    }
  }
}

export default RampnowWebhookController;
