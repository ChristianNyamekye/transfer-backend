import prisma from '@/lib/database';
import circleService from '@/services/circleService';

export class WalletService {
  // Create a wallet with Circle integration
  static async createWalletWithCircle(
    userId: string,
    currency: string,
    blockchain: string = 'ETH',
  ): Promise<any> {
    try {
      // First, create the local wallet
      const localWallet = await prisma.wallet.create({
        data: {
          userId,
          currency: currency as any,
          balance: 0,
          availableBalance: 0,
          reservedBalance: 0,
          circleChain: blockchain,
          circleStatus: 'CREATING',
        },
      });

      // For production: Create real Circle wallet
      // For now, we'll create a logical mapping since we need wallet sets configured
      let circleWalletId = null;
      let circleAddress = null;

      try {
        // This will work once wallet sets and entity secrets are configured in Circle dashboard
        const circleWallet = await circleService.createWallet(userId, [blockchain]);
        circleWalletId = circleWallet.walletId;
        circleAddress = circleWallet.address;

        // Update wallet with Circle information
        await prisma.wallet.update({
          where: { id: localWallet.id },
          data: {
            circleWalletId,
            circleAddress,
            circleStatus: 'ACTIVE',
          },
        });

        console.log(`Circle wallet created for ${currency}:`, {
          walletId: circleWalletId,
          address: circleAddress,
          blockchain,
        });
      } catch (circleError) {
        // Circle wallet creation failed - use logical mapping for now
        const logicalWalletId = `${userId}_${currency}_${blockchain}`;
        const logicalAddress = `0x${userId.slice(-20).padStart(20, '0')}${currency}${blockchain}`;

        await prisma.wallet.update({
          where: { id: localWallet.id },
          data: {
            circleWalletId: logicalWalletId,
            circleAddress: logicalAddress,
            circleStatus: 'LOGICAL_MAPPING',
          },
        });

        console.log(`Logical wallet mapping created for ${currency}:`, {
          walletId: logicalWalletId,
          address: logicalAddress,
          blockchain,
          note: 'Will be replaced with real Circle wallet once entity secrets are configured',
        });
      }

      return localWallet;
    } catch (error) {
      throw new Error(
        `Failed to create wallet for ${currency}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Get wallet with Circle information
  static async getWalletWithCircleInfo(walletId: string): Promise<any> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            circleCustomerId: true,
          },
        },
      },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return {
      ...wallet,
      isCircleIntegrated: !!wallet.circleWalletId,
      isRealCircleWallet: wallet.circleStatus === 'ACTIVE',
      isLogicalMapping: wallet.circleStatus === 'LOGICAL_MAPPING',
    };
  }

  // Sync wallet balance with Circle (for real Circle wallets)
  static async syncWalletBalance(walletId: string): Promise<void> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet || !wallet.circleWalletId || wallet.circleStatus !== 'ACTIVE') {
      return; // Skip sync for non-Circle wallets or logical mappings
    }

    try {
      // Get balance from Circle
      const circleBalance = await circleService.getWalletBalance(wallet.circleWalletId);

      // Update local balance to match Circle balance
      await prisma.wallet.update({
        where: { id: walletId },
        data: {
          balance: parseFloat(circleBalance),
          availableBalance: parseFloat(circleBalance),
        },
      });

      console.log(`Synced wallet balance for ${wallet.currency}:`, circleBalance);
    } catch (error) {
      console.error(`Failed to sync balance for wallet ${walletId}:`, error);
    }
  }
}
