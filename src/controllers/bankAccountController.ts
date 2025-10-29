import { Request, Response } from 'express';
import { ApiResponse } from '@/types/common';
import { BankAccountService, BankAccountData } from '@/services/bankAccountService';

export class BankAccountController {
  // Link new bank account
  static async linkBankAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const bankData: BankAccountData = {
        accountNumber: req.body.accountNumber,
        routingNumber: req.body.routingNumber,
        bankName: req.body.bankName,
        accountType: req.body.accountType,
        accountHolderName: req.body.accountHolderName,
        nickname: req.body.nickname,
      };

      const bankAccount = await BankAccountService.linkBankAccount(req.user.id, bankData);

      const response: ApiResponse = {
        success: true,
        message: 'Bank account linked successfully',
        data: {
          id: bankAccount.id,
          bankName: bankAccount.bankName,
          accountType: bankAccount.accountType,
          isVerified: bankAccount.isVerified,
          circleStatus: bankAccount.circleStatus,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to link bank account',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Get user's bank accounts
  static async getBankAccounts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const bankAccounts = await BankAccountService.getUserBankAccounts(req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Bank accounts retrieved successfully',
        data: bankAccounts,
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve bank accounts',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Verify bank account
  static async verifyBankAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { bankAccountId } = req.params;
      const verificationData = req.body;

      await BankAccountService.verifyBankAccount(bankAccountId, verificationData);

      const response: ApiResponse = {
        success: true,
        message: 'Bank account verified successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to verify bank account',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Set primary bank account
  static async setPrimaryBankAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { bankAccountId } = req.params;

      await BankAccountService.setPrimaryBankAccount(req.user.id, bankAccountId);

      const response: ApiResponse = {
        success: true,
        message: 'Primary bank account updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to set primary bank account',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }

  // Remove bank account
  static async removeBankAccount(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { bankAccountId } = req.params;

      await BankAccountService.removeBankAccount(req.user.id, bankAccountId);

      const response: ApiResponse = {
        success: true,
        message: 'Bank account removed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Failed to remove bank account',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      res.status(500).json(response);
    }
  }
}
