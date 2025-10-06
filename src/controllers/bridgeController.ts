import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import { BridgeService } from '@/services/bridgeService';

export class BridgeController {
  // Initialize master USDC bridge wallet
  static async initializeBridge(req: Request, res: Response): Promise<void> {
    try {
      const masterWallet = await BridgeService.createMasterBridgeWallet();

      const response: ApiResponse = {
        success: true,
        message: 'USDC bridge initialized successfully',
        data: {
          masterWallet: {
            id: masterWallet.walletId,
            address: masterWallet.address,
            blockchain: masterWallet.blockchain,
          },
          status: 'active',
          initializedAt: new Date().toISOString(),
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to initialize USDC bridge',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Get bridge liquidity status
  static async getBridgeStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await BridgeService.getBridgeLiquidityStatus();

      const response: ApiResponse = {
        success: true,
        message: 'Bridge status retrieved successfully',
        data: status,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to get bridge status',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Trigger liquidity rebalancing
  static async rebalanceLiquidity(req: Request, res: Response): Promise<void> {
    try {
      await BridgeService.rebalanceLiquidity();

      const response: ApiResponse = {
        success: true,
        message: 'Liquidity rebalancing completed successfully',
        data: {
          rebalancedAt: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to rebalance liquidity',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Process bridge transfer (for testing)
  static async processBridgeTransfer(req: Request, res: Response): Promise<void> {
    try {
      const { fromWalletId, toWalletId, amount, fromCurrency, toCurrency } = req.body;

      const bridgeTransfer = await BridgeService.processBridgeTransfer(
        fromWalletId,
        toWalletId,
        amount,
        fromCurrency,
        toCurrency,
      );

      const response: ApiResponse = {
        success: true,
        message: 'Bridge transfer processed successfully',
        data: bridgeTransfer,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to process bridge transfer',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }
}
