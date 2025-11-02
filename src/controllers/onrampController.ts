import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import { BankAccountService } from '@/services/bankAccountService';
import prisma from '@/lib/database';
import { ExchangeRateService } from '@/services/exchangeRateService';
import { RampnowService } from '@/services/rampnowService';

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

      // For onramp, Rampnow sends USDC, so we need a USDC wallet with Circle address
      // Get or create a USDC wallet for this user
      let usdcWallet = await prisma.wallet.findFirst({
        where: {
          userId: req.user.id,
          currency: 'USDC',
          isActive: true,
        },
      });

      // If no USDC wallet exists or it doesn't have Circle address, create one
      if (!usdcWallet || !usdcWallet.circleAddress || !usdcWallet.circleChain) {
        try {
          const { WalletService } = await import('@/services/walletService');
          const newWallet = await WalletService.createWalletWithCircle(req.user.id, 'USDC', 'ETH');
          // Refetch to ensure we have the latest data including circleAddress
          usdcWallet = await prisma.wallet.findUnique({
            where: { id: newWallet.id },
          });
        } catch (createError) {
          console.error('Failed to create USDC wallet:', createError);
          // If creation fails, try to use existing wallet or create a fallback
          if (!usdcWallet) {
            const response: ApiResponse = {
              success: false,
              message:
                'Failed to create USDC wallet for onramp. Please ensure Circle wallet configuration is set up.',
            };
            res.status(500).json(response);
            return;
          }
        }
      }

      // Ensure we have a wallet at this point
      if (!usdcWallet) {
        const response: ApiResponse = {
          success: false,
          message: 'Failed to create or retrieve USDC wallet for onramp.',
        };
        res.status(500).json(response);
        return;
      }

      // Ensure we have the Circle address
      if (!usdcWallet.circleAddress || !usdcWallet.circleChain) {
        const response: ApiResponse = {
          success: false,
          message: 'USDC wallet is missing Circle address. Please contact support.',
        };
        res.status(400).json(response);
        return;
      }

      // Map blockchain name for Rampnow (they might expect different format)
      // Common mappings: ETH -> ETHEREUM, POLY -> POLYGON, etc.
      const networkMap: Record<string, string> = {
        ETH: 'ETHEREUM',
        POLY: 'POLYGON',
        POLYGON: 'POLYGON',
        MATIC: 'POLYGON',
        'MATIC-MUMBAI': 'POLYGON',
        'POLYGON-MUMBAI': 'POLYGON',
      };
      const rampnowNetwork =
        networkMap[usdcWallet.circleChain] || usdcWallet.circleChain.toUpperCase();

      // Create Rampnow onramp session - NO FALLBACK, must work
      let checkoutUrl: string | undefined;
      let clientToken: string | undefined;

      // Get user information for Rampnow checkout endpoint (requires full user object)
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          country: true,
          address: true,
          city: true,
          postalCode: true,
        },
      });

      if (!user || !user.email) {
        const response: ApiResponse = {
          success: false,
          message: 'User email is required for Rampnow',
        };
        res.status(400).json(response);
        return;
      }

      // Format dateOfBirth for Rampnow (ISO8601 datetime format)
      const dateOfBirthStr = user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString()
        : undefined;

      // Build webhook URL for Rampnow callbacks
      const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/v1/webhooks/rampnow`;
      const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/add-funds?status=completed`;

      try {
        const rampnow = new RampnowService();
        let session: {
          id: string;
          status: string;
          checkoutUrl?: string;
          clientToken?: string;
          createdAt?: string;
        };

        try {
          // Checkout endpoint requires full user object with address
          session = await rampnow.createOnrampSession({
            amount: Number(totalBankDeduction.toFixed(2)),
            currency: bankCurrency,
            destinationAddress: usdcWallet.circleAddress!,
            destinationNetwork: rampnowNetwork,
            destinationAsset: 'USDC',
            externalOrderUid: onrampTransaction.reference, // Use our transaction reference as external order UID
            userEmail: user.email,
            userFirstName: user.firstName || undefined,
            userLastName: user.lastName || undefined,
            userPhone: user.phone || undefined,
            userDateOfBirth: dateOfBirthStr,
            userGender: undefined, // Not stored in our User model
            userCountry: user.country || 'US',
            userAddress: {
              // Provide defaults for required address fields
              line1: user.address || 'N/A',
              city: user.city || 'N/A',
              postalCode: user.postalCode || '00000',
            },
            returnUrl: returnUrl,
            webhookUrl: webhookUrl,
            metadata: {
              onrampTransactionId: onrampTransaction.id,
              targetWalletId: wallet.id,
              targetCurrency: targetCurrency,
              usdcWalletId: usdcWallet.id,
            },
          });
        } catch (rampnowError: any) {
          // If checkout mode isn't available, use Widget Mode (direct URL, no API call)
          if (
            (rampnowError as any).shouldUseWidgetMode ||
            rampnowError.message === 'CHECKOUT_MODE_NOT_AVAILABLE'
          ) {
            if (process.env.NODE_ENV === 'development') {
              console.log('⚠️  Checkout mode not available, using Widget Mode (direct URL)');
            }

            // Use Widget Mode - construct URL directly (no API call needed)
            const widgetUrl = rampnow.createWidgetModeUrl({
              amount: Number(totalBankDeduction.toFixed(2)),
              currency: bankCurrency,
              destinationAddress: usdcWallet.circleAddress!,
              destinationNetwork: rampnowNetwork,
              destinationAsset: 'USDC',
              externalOrderUid: onrampTransaction.reference,
              userEmail: user.email,
              returnUrl: returnUrl,
              webhookUrl: webhookUrl,
            });

            session = {
              id: `widget-${onrampTransaction.reference}`,
              status: 'pending',
              checkoutUrl: widgetUrl,
              clientToken: undefined,
            };
          } else if (process.env.NODE_ENV === 'development') {
            // If Rampnow API fails for other reasons, use development fallback
            console.warn('⚠️  Rampnow API unavailable - using development simulation');

            // Use Widget Mode as fallback
            const widgetUrl = rampnow.createWidgetModeUrl({
              amount: Number(totalBankDeduction.toFixed(2)),
              currency: bankCurrency,
              destinationAddress: usdcWallet.circleAddress!,
              destinationNetwork: rampnowNetwork,
              destinationAsset: 'USDC',
              externalOrderUid: onrampTransaction.reference,
              userEmail: user.email,
              returnUrl: returnUrl,
              webhookUrl: webhookUrl,
            });

            session = {
              id: `widget-${onrampTransaction.reference}`,
              status: 'pending',
              checkoutUrl: widgetUrl,
              clientToken: undefined,
            };

            // Simulate webhook after 3 seconds in development
            setTimeout(async () => {
              try {
                // Import and call webhook handler directly (simulating webhook)
                const { RampnowWebhookController } = await import(
                  '@/controllers/rampnowWebhookController'
                );
                const mockReq = {
                  body: {
                    // Webhook handler expects 'id' or 'sessionId' field
                    id: session.id,
                    sessionId: session.id,
                    externalOrderUid: onrampTransaction.reference,
                    orderUid: session.id,
                    status: 'completed',
                    orderStatus: 'completed',
                    dstAmount: onrampTransaction.usdcAmount.toString(),
                    dstCurrency: 'USDC',
                  },
                  header: (name: string) => undefined, // Mock header method for signature verification
                  headers: {},
                } as any;
                const mockRes = {
                  status: (code: number) => ({
                    json: (data: any) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log('Simulated Rampnow webhook:', code);
                      }
                    },
                  }),
                } as any;

                await RampnowWebhookController.handle(mockReq, mockRes);
              } catch (webhookError) {
                console.error('Error in simulated webhook:', webhookError);
              }
            }, 3000);
          } else {
            // In production, fail if Rampnow is not configured
            throw rampnowError;
          }
        }

        checkoutUrl = session.checkoutUrl;
        clientToken = session.clientToken;

        if (!checkoutUrl) {
          console.warn('Rampnow session created but no checkoutUrl returned:', session);
          throw new Error('Rampnow session created but no checkout URL provided');
        }

        await prisma.onrampTransaction.update({
          where: { id: onrampTransaction.id },
          data: {
            circleTransferId: session.id, // temporary reuse of field to store provider session id
            circleStatus: session.status,
          },
        });

        await prisma.onrampStatusHistory.create({
          data: {
            transactionId: onrampTransaction.id,
            status: 'PROCESSING',
            message: 'Rampnow session created successfully',
            metadata: { checkoutUrl, clientToken, sessionId: session.id },
          },
        });
      } catch (error) {
        console.error('Rampnow onramp session creation failed:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Update transaction status to failed
        await prisma.onrampTransaction.update({
          where: { id: onrampTransaction.id },
          data: {
            status: 'FAILED',
            circleStatus: 'FAILED',
          },
        });

        await prisma.onrampStatusHistory.create({
          data: {
            transactionId: onrampTransaction.id,
            status: 'FAILED',
            message: `Rampnow session creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
          },
        });

        // Return error to frontend - NO FALLBACK
        const errorResponse: ApiResponse = {
          success: false,
          message: 'Failed to create Rampnow checkout session',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            transactionId: onrampTransaction.id,
          },
        };
        res.status(500).json(errorResponse);
        return;
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
          checkoutUrl,
          clientToken,
          estimatedCompletion: checkoutUrl ? 'Instant via Rampnow' : '1-3 business days',
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
