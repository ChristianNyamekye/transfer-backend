import prisma from '@/lib/database';
import circleService from '@/services/circleService';

export interface BankAccountData {
  accountNumber: string;
  routingNumber?: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS';
  accountHolderName: string;
  nickname?: string;
}

export class BankAccountService {
  // Link bank account with Circle integration
  static async linkBankAccount(userId: string, bankData: BankAccountData): Promise<any> {
    try {
      console.log('Linking bank account for user:', userId);

      // First, create local bank account record
      const bankAccount = await prisma.bankAccount.create({
        data: {
          userId,
          accountNumber: bankData.accountNumber,
          routingNumber: bankData.routingNumber,
          bankName: bankData.bankName,
          accountType: bankData.accountType,
          accountHolderName: bankData.accountHolderName,
          nickname: bankData.nickname,
          circleStatus: 'PENDING',
        },
      });

      // Integrate with Circle bank account linking
      let circleBankId = null;
      try {
        // For now, create a logical bank account mapping
        // In production, this would use Circle's Cross-Currency API
        circleBankId = `circle_bank_${bankAccount.id}_${Date.now()}`;

        // Simulate Circle bank account verification
        const verificationStatus =
          await BankAccountService.simulateCircleBankVerification(bankData);

        // Update with Circle bank ID and verification status
        await prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: {
            circleBankId,
            circleStatus: verificationStatus.status,
            isVerified: verificationStatus.verified,
            verificationMethod: verificationStatus.method,
            verificationDate: verificationStatus.verified ? new Date() : null,
          },
        });

        console.log('Circle bank account integration completed:', {
          bankAccountId: bankAccount.id,
          circleBankId,
          bankName: bankData.bankName,
          accountHolderName: bankData.accountHolderName,
          verificationStatus: verificationStatus.status,
        });
      } catch (circleError) {
        console.error('Circle bank linking failed:', circleError);

        // Update status to failed
        await prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: {
            circleStatus: 'FAILED',
          },
        });

        throw new Error('Failed to link bank account with Circle');
      }

      return bankAccount;
    } catch (error) {
      throw new Error(
        `Failed to link bank account: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Get user's bank accounts
  static async getUserBankAccounts(userId: string): Promise<any[]> {
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return bankAccounts.map(account => ({
      id: account.id,
      bankName: account.bankName,
      accountType: account.accountType,
      accountNumber: `****${account.accountNumber.slice(-4)}`, // Masked for security
      accountHolderName: account.accountHolderName,
      isVerified: account.isVerified,
      isPrimary: account.isPrimary,
      verificationMethod: account.verificationMethod,
      circleStatus: account.circleStatus,
      createdAt: account.createdAt,
    }));
  }

  // Verify bank account (micro deposits or instant verification)
  static async verifyBankAccount(bankAccountId: string, verificationData?: any): Promise<void> {
    try {
      const bankAccount = await prisma.bankAccount.findUnique({
        where: { id: bankAccountId },
      });

      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // For development: Auto-verify
      // In production: Use Circle's verification API
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          isVerified: true,
          verificationMethod: 'INSTANT',
          verificationDate: new Date(),
          circleStatus: 'VERIFIED',
        },
      });

      console.log('Bank account verified:', bankAccountId);
    } catch (error) {
      throw new Error(
        `Failed to verify bank account: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Set primary bank account
  static async setPrimaryBankAccount(userId: string, bankAccountId: string): Promise<void> {
    try {
      // Remove primary status from all user's bank accounts
      await prisma.bankAccount.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });

      // Set the specified account as primary
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { isPrimary: true },
      });

      console.log('Primary bank account updated:', bankAccountId);
    } catch (error) {
      throw new Error(
        `Failed to set primary bank account: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Remove bank account
  static async removeBankAccount(userId: string, bankAccountId: string): Promise<void> {
    try {
      const bankAccount = await prisma.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId,
        },
      });

      if (!bankAccount) {
        throw new Error('Bank account not found');
      }

      // Soft delete - mark as inactive
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { isActive: false },
      });

      console.log('Bank account removed:', bankAccountId);
    } catch (error) {
      throw new Error(
        `Failed to remove bank account: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Simulate Circle bank account verification (replace with real Circle API in production)
  private static async simulateCircleBankVerification(bankData: BankAccountData): Promise<{
    status: string;
    verified: boolean;
    method: string;
  }> {
    // Simulate different verification outcomes based on bank
    const bankName = bankData.bankName.toLowerCase();

    if (
      bankName.includes('chase') ||
      bankName.includes('wells') ||
      bankName.includes('bank of america')
    ) {
      // Major US banks - instant verification
      return {
        status: 'VERIFIED',
        verified: true,
        method: 'INSTANT',
      };
    } else if (bankName.includes('credit union') || bankName.includes('community')) {
      // Smaller banks - micro deposit verification
      return {
        status: 'PENDING_VERIFICATION',
        verified: false,
        method: 'MICRO_DEPOSITS',
      };
    } else {
      // Unknown banks - manual review
      return {
        status: 'PENDING_REVIEW',
        verified: false,
        method: 'MANUAL_REVIEW',
      };
    }
  }
}
