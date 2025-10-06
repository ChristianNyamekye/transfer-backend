import prisma from '@/lib/database';
import circleService from '@/services/circleService';
import { ExchangeRateService } from '@/services/exchangeRateService';
import config from '@/config';

interface BridgePool {
  id: string;
  currency: string;
  usdcBalance: number;
  reservedBalance: number;
  availableBalance: number;
  lastRebalance: Date;
}

interface BridgeTransfer {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  usdcAmount: number;
  toAmount: number;
  exchangeRate: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  steps: BridgeStep[];
}

interface BridgeStep {
  step: number;
  action: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  timestamp: Date;
}

export class BridgeService {
  // Create master USDC bridge wallet for liquidity management
  static async createMasterBridgeWallet(): Promise<any> {
    try {
      console.log('Creating master USDC bridge wallet...');

      // Create master USDC wallet using Circle
      const masterWallet = await circleService.createWallet('bridge-master', ['ETH']);

      // Store master wallet info in a separate bridge_wallets table or use first admin user
      // For now, let's create a system user or use the first user as bridge owner
      let systemUser = await prisma.user.findFirst({
        where: { email: { contains: 'admin' } },
      });

      if (!systemUser) {
        // Use the first user as bridge owner
        systemUser = await prisma.user.findFirst();
      }

      if (!systemUser) {
        throw new Error('No user found to own bridge wallet - create a user first');
      }

      // Store master wallet info in database
      await prisma.wallet.create({
        data: {
          userId: systemUser.id,
          currency: 'USDC',
          balance: 0,
          availableBalance: 0,
          reservedBalance: 0,
          circleWalletId: masterWallet.walletId,
          circleAddress: masterWallet.address,
          circleChain: 'ETH',
          circleStatus: 'ACTIVE',
        },
      });

      console.log('Master USDC bridge wallet created:', {
        walletId: masterWallet.walletId,
        address: masterWallet.address,
      });

      return masterWallet;
    } catch (error) {
      throw new Error(
        `Failed to create master bridge wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Process currency conversion through USDC bridge
  static async processBridgeTransfer(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<BridgeTransfer> {
    try {
      const transferId = `bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Get current exchange rates
      const fromToUsdcRate = await ExchangeRateService.getExchangeRate(fromCurrency, 'USD');
      const usdcToToRate = await ExchangeRateService.getExchangeRate('USD', toCurrency);

      // Calculate USDC amounts
      const usdcAmount = amount * fromToUsdcRate;
      const finalAmount = usdcAmount * usdcToToRate;

      const bridgeTransfer: BridgeTransfer = {
        id: transferId,
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        usdcAmount,
        toAmount: finalAmount,
        exchangeRate: fromToUsdcRate * usdcToToRate,
        status: 'pending',
        steps: [
          {
            step: 1,
            action: `Convert ${amount} ${fromCurrency} to ${usdcAmount.toFixed(6)} USDC`,
            status: 'pending',
            timestamp: new Date(),
          },
          {
            step: 2,
            action: `Transfer ${usdcAmount.toFixed(6)} USDC via Circle Gateway`,
            status: 'pending',
            timestamp: new Date(),
          },
          {
            step: 3,
            action: `Convert ${usdcAmount.toFixed(6)} USDC to ${finalAmount.toFixed(2)} ${toCurrency}`,
            status: 'pending',
            timestamp: new Date(),
          },
        ],
      };

      console.log('Bridge transfer initiated:', {
        id: transferId,
        route: `${fromCurrency} → USDC → ${toCurrency}`,
        amounts: `${amount} → ${usdcAmount.toFixed(6)} → ${finalAmount.toFixed(2)}`,
      });

      return bridgeTransfer;
    } catch (error) {
      throw new Error(
        `Bridge transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Get bridge liquidity status
  static async getBridgeLiquidityStatus(): Promise<any> {
    try {
      // Get master USDC wallet
      const masterWallet = await prisma.wallet.findFirst({
        where: {
          currency: 'USDC',
          circleStatus: 'ACTIVE',
        },
      });

      if (!masterWallet) {
        return {
          status: 'not_initialized',
          message: 'Master USDC bridge wallet not found',
        };
      }

      // Get current USDC balance from Circle
      let circleBalance = '0';
      try {
        circleBalance = await circleService.getWalletBalance(masterWallet.circleWalletId!);
      } catch (error) {
        console.log('Could not fetch Circle balance, using local balance');
      }

      return {
        status: 'active',
        masterWallet: {
          id: masterWallet.circleWalletId,
          address: masterWallet.circleAddress,
          localBalance: parseFloat(masterWallet.balance.toString()),
          circleBalance: parseFloat(circleBalance),
        },
        liquidityPools: await this.getLiquidityPools(),
        lastUpdate: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to get bridge status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Get liquidity pools for each currency
  private static async getLiquidityPools(): Promise<BridgePool[]> {
    const currencies = ['GHS', 'NGN', 'USD', 'EUR', 'GBP'];

    return currencies.map(currency => ({
      id: `pool_${currency}_USDC`,
      currency,
      usdcBalance: 0, // Would be fetched from actual pools
      reservedBalance: 0,
      availableBalance: 0,
      lastRebalance: new Date(),
    }));
  }

  // Monitor and rebalance liquidity pools
  static async rebalanceLiquidity(): Promise<void> {
    try {
      console.log('Starting liquidity rebalancing...');

      const status = await this.getBridgeLiquidityStatus();

      if (status.status !== 'active') {
        console.log('Bridge not active, skipping rebalancing');
        return;
      }

      // Check if rebalancing is needed
      const masterBalance = status.masterWallet.circleBalance;
      const minimumBalance = 1000; // Minimum 1000 USDC

      if (masterBalance < minimumBalance) {
        console.log(`Low liquidity detected: ${masterBalance} USDC < ${minimumBalance} USDC`);
        // In production: Trigger liquidity top-up alerts or automatic funding
      }

      console.log('Liquidity rebalancing completed');
    } catch (error) {
      console.error('Liquidity rebalancing failed:', error);
    }
  }
}
