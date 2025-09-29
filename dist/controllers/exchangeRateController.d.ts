import { Request, Response } from 'express';
export declare class ExchangeRateController {
    static getCurrentRates(req: Request, res: Response): Promise<void>;
    static convertCurrency(req: Request, res: Response): Promise<void>;
    static getCurrencyInfo(req: Request, res: Response): Promise<void>;
    static getSupportedCurrencies(req: Request, res: Response): Promise<void>;
    static updateRates(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=exchangeRateController.d.ts.map