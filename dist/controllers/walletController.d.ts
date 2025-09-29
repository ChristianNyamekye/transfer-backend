import { Request, Response } from 'express';
export declare class WalletController {
    static getUserWallets(req: Request, res: Response): Promise<void>;
    static getWalletStats(req: Request, res: Response): Promise<void>;
    static addCurrencyWallet(req: Request, res: Response): Promise<void>;
    static addFunds(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=walletController.d.ts.map