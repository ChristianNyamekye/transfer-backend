interface CurrencyInfo {
    flag: string;
    symbol: string;
    name: string;
    country: string;
}
export declare class ExchangeRateService {
    private static readonly API_BASE_URL;
    private static readonly CACHE_DURATION;
    private static readonly CURRENCY_INFO;
    static fetchLatestRates(baseCurrency?: string): Promise<Record<string, number> | null>;
    static getExchangeRates(baseCurrency?: string): Promise<Record<string, number>>;
    private static getCachedRates;
    private static cacheRates;
    private static getFallbackRates;
    static convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<{
        convertedAmount: number;
        rate: number;
        timestamp: Date;
    }>;
    static getCurrencyInfo(currencyCode: string): CurrencyInfo;
    static getSupportedCurrencies(): string[];
    static getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>;
    static updateExchangeRates(): Promise<boolean>;
    static getRateUpdateStatus(): Promise<{
        lastUpdate: Date | null;
        nextUpdate: Date | null;
        source: string;
        totalRates: number;
    }>;
}
export {};
//# sourceMappingURL=exchangeRateService.d.ts.map