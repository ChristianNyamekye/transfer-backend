import axios from 'axios';
import prisma from '@/lib/database';

interface ExchangeRateApiResponse {
  provider: string;
  base: string;
  date: string;
  time_last_updated: number;
  rates: Record<string, number>;
}

interface CurrencyInfo {
  flag: string;
  symbol: string;
  name: string;
  country: string;
}

export class ExchangeRateService {
  private static readonly API_BASE_URL = 'https://api.exchangerate-api.com/v4';
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

  // Comprehensive currency information
  private static readonly CURRENCY_INFO: Record<string, CurrencyInfo> = {
    // Major currencies
    USD: { flag: '🇺🇸', symbol: '$', name: 'US Dollar', country: 'United States' },
    EUR: { flag: '🇪🇺', symbol: '€', name: 'Euro', country: 'European Union' },
    GBP: { flag: '🇬🇧', symbol: '£', name: 'British Pound', country: 'United Kingdom' },
    JPY: { flag: '🇯🇵', symbol: '¥', name: 'Japanese Yen', country: 'Japan' },
    CHF: { flag: '🇨🇭', symbol: 'CHF', name: 'Swiss Franc', country: 'Switzerland' },
    CAD: { flag: '🇨🇦', symbol: 'C$', name: 'Canadian Dollar', country: 'Canada' },
    AUD: { flag: '🇦🇺', symbol: 'A$', name: 'Australian Dollar', country: 'Australia' },
    CNY: { flag: '🇨🇳', symbol: '¥', name: 'Chinese Yuan', country: 'China' },

    // African currencies
    NGN: { flag: '🇳🇬', symbol: '₦', name: 'Nigerian Naira', country: 'Nigeria' },
    GHS: { flag: '🇬🇭', symbol: '₵', name: 'Ghanaian Cedi', country: 'Ghana' },
    KES: { flag: '🇰🇪', symbol: 'KSh', name: 'Kenyan Shilling', country: 'Kenya' },
    ZAR: { flag: '🇿🇦', symbol: 'R', name: 'South African Rand', country: 'South Africa' },
    EGP: { flag: '🇪🇬', symbol: 'E£', name: 'Egyptian Pound', country: 'Egypt' },
    MAD: { flag: '🇲🇦', symbol: 'MAD', name: 'Moroccan Dirham', country: 'Morocco' },
    TND: { flag: '🇹🇳', symbol: 'DT', name: 'Tunisian Dinar', country: 'Tunisia' },
    ETB: { flag: '🇪🇹', symbol: 'Br', name: 'Ethiopian Birr', country: 'Ethiopia' },
    UGX: { flag: '🇺🇬', symbol: 'USh', name: 'Ugandan Shilling', country: 'Uganda' },
    TZS: { flag: '🇹🇿', symbol: 'TSh', name: 'Tanzanian Shilling', country: 'Tanzania' },
    RWF: { flag: '🇷🇼', symbol: 'FRw', name: 'Rwandan Franc', country: 'Rwanda' },
    MZN: { flag: '🇲🇿', symbol: 'MT', name: 'Mozambican Metical', country: 'Mozambique' },
    XOF: { flag: '🇸🇳', symbol: 'CFA', name: 'West African CFA Franc', country: 'West Africa' },
    XAF: {
      flag: '🇨🇲',
      symbol: 'FCFA',
      name: 'Central African CFA Franc',
      country: 'Central Africa',
    },
    ZMW: { flag: '🇿🇲', symbol: 'ZK', name: 'Zambian Kwacha', country: 'Zambia' },
    BWP: { flag: '🇧🇼', symbol: 'P', name: 'Botswana Pula', country: 'Botswana' },

    // Middle East & Asia
    AED: { flag: '🇦🇪', symbol: 'د.إ', name: 'UAE Dirham', country: 'UAE' },
    SAR: { flag: '🇸🇦', symbol: '﷼', name: 'Saudi Riyal', country: 'Saudi Arabia' },
    INR: { flag: '🇮🇳', symbol: '₹', name: 'Indian Rupee', country: 'India' },
    SGD: { flag: '🇸🇬', symbol: 'S$', name: 'Singapore Dollar', country: 'Singapore' },
    HKD: { flag: '🇭🇰', symbol: 'HK$', name: 'Hong Kong Dollar', country: 'Hong Kong' },
    KRW: { flag: '🇰🇷', symbol: '₩', name: 'South Korean Won', country: 'South Korea' },
    THB: { flag: '🇹🇭', symbol: '฿', name: 'Thai Baht', country: 'Thailand' },
    PHP: { flag: '🇵🇭', symbol: '₱', name: 'Philippine Peso', country: 'Philippines' },
    IDR: { flag: '🇮🇩', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'Indonesia' },
    MYR: { flag: '🇲🇾', symbol: 'RM', name: 'Malaysian Ringgit', country: 'Malaysia' },

    // Americas
    BRL: { flag: '🇧🇷', symbol: 'R$', name: 'Brazilian Real', country: 'Brazil' },
    MXN: { flag: '🇲🇽', symbol: '$', name: 'Mexican Peso', country: 'Mexico' },

    // Europe
    SEK: { flag: '🇸🇪', symbol: 'kr', name: 'Swedish Krona', country: 'Sweden' },
    NOK: { flag: '🇳🇴', symbol: 'kr', name: 'Norwegian Krone', country: 'Norway' },
    NZD: { flag: '🇳🇿', symbol: 'NZ$', name: 'New Zealand Dollar', country: 'New Zealand' },
  };

  // Get real-time exchange rates from ExchangeRate-API
  static async fetchLatestRates(
    baseCurrency: string = 'USD',
  ): Promise<Record<string, number> | null> {
    try {
      const response = await axios.get<ExchangeRateApiResponse>(
        `${this.API_BASE_URL}/latest/${baseCurrency}`,
        {
          timeout: 10000, // 10 second timeout
          headers: {
            'User-Agent': 'AfriTransfer-Platform/1.0',
          },
        },
      );

      if (response.data.rates) {
        return response.data.rates;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  // Get cached exchange rates or fetch new ones
  static async getExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
    try {
      // Check for cached rates
      const cachedRates = await this.getCachedRates(baseCurrency);
      if (cachedRates && Object.keys(cachedRates).length > 0) {
        return cachedRates;
      }

      // Fetch fresh rates
      const freshRates = await this.fetchLatestRates(baseCurrency);
      if (freshRates) {
        // Cache the new rates
        await this.cacheRates(baseCurrency, freshRates);
        return freshRates;
      }

      // Fallback to hardcoded rates if API fails
      return this.getFallbackRates();
    } catch (error) {
      return this.getFallbackRates();
    }
  }

  // Get cached rates from database
  private static async getCachedRates(
    baseCurrency: string,
  ): Promise<Record<string, number> | null> {
    try {
      const oneHourAgo = new Date(Date.now() - this.CACHE_DURATION);

      const cachedRates = await prisma.exchangeRate.findMany({
        where: {
          fromCurrency: baseCurrency as any,
          timestamp: {
            gte: oneHourAgo,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (cachedRates.length === 0) {
        return null;
      }

      // Convert to Record<string, number> format
      const rates: Record<string, number> = {};
      cachedRates.forEach(rate => {
        rates[rate.toCurrency] = parseFloat(rate.rate.toString());
      });

      return rates;
    } catch (error) {
      return null;
    }
  }

  // Cache rates in database
  private static async cacheRates(
    baseCurrency: string,
    rates: Record<string, number>,
  ): Promise<void> {
    try {
      // Delete old rates for this base currency
      await prisma.exchangeRate.deleteMany({
        where: {
          fromCurrency: baseCurrency as any,
        },
      });

      // Filter rates to only include currencies supported by our database
      const supportedCurrencies = this.getSupportedCurrencies();
      const filteredRates = Object.entries(rates).filter(([currency]) =>
        supportedCurrencies.includes(currency),
      );

      // Insert new rates
      const rateRecords = filteredRates.map(([toCurrency, rate]) => ({
        fromCurrency: baseCurrency as any,
        toCurrency: toCurrency as any,
        rate: rate,
        source: 'exchangerate-api',
        timestamp: new Date(),
      }));

      if (rateRecords.length > 0) {
        await prisma.exchangeRate.createMany({
          data: rateRecords,
        });
      }
    } catch (error) {
      // Silently handle caching errors
    }
  }

  // Fallback rates in case API is down
  private static getFallbackRates(): Record<string, number> {
    return {
      USD: 1.0,
      NGN: 0.00067,
      GHS: 0.065,
      KES: 0.0064,
      ZAR: 0.054,
      EGP: 0.0324,
      GBP: 1.27,
      EUR: 1.09,
      CAD: 0.74,
      AUD: 0.66,
      JPY: 0.0067,
      CHF: 1.1,
      CNY: 0.137,
      INR: 0.012,
      BRL: 0.201,
      MXN: 0.058,
      SGD: 0.741,
      HKD: 0.128,
      NZD: 0.602,
      SEK: 0.092,
      NOK: 0.093,
      KRW: 0.00075,
      THB: 0.028,
      PHP: 0.0178,
      IDR: 0.0000647,
      MYR: 0.214,
      MAD: 0.0985,
      TND: 0.318,
      ETB: 0.0178,
      UGX: 0.000267,
      TZS: 0.000398,
      XOF: 0.00162,
      XAF: 0.00162,
      RWF: 0.000787,
      MZN: 0.0157,
      ZMW: 0.039,
      BWP: 0.074,
      AED: 0.272,
      SAR: 0.267,
    };
  }

  // Convert amount between currencies
  static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ convertedAmount: number; rate: number; timestamp: Date }> {
    try {
      const rates = await this.getExchangeRates('USD');

      // Convert to USD first, then to target currency
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[toCurrency] || 1;

      // If converting from non-USD, first convert to USD, then to target
      let convertedAmount: number;
      let effectiveRate: number;

      if (fromCurrency === 'USD') {
        convertedAmount = amount * toRate;
        effectiveRate = toRate;
      } else if (toCurrency === 'USD') {
        convertedAmount = amount / fromRate;
        effectiveRate = 1 / fromRate;
      } else {
        // Convert via USD: amount → USD → target currency
        const usdAmount = amount / fromRate;
        convertedAmount = usdAmount * toRate;
        effectiveRate = toRate / fromRate;
      }

      return {
        convertedAmount: parseFloat(convertedAmount.toFixed(8)),
        rate: parseFloat(effectiveRate.toFixed(8)),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw new Error('Failed to convert currency');
    }
  }

  // Get currency information (flag, symbol, name)
  static getCurrencyInfo(currencyCode: string): CurrencyInfo {
    return (
      this.CURRENCY_INFO[currencyCode] || {
        flag: '🏳️',
        symbol: currencyCode,
        name: currencyCode,
        country: 'Unknown',
      }
    );
  }

  // Get all supported currencies
  static getSupportedCurrencies(): string[] {
    return Object.keys(this.CURRENCY_INFO);
  }

  // Get exchange rate between two currencies
  static async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // If same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    try {
      // Try to get rate from database cache first
      const cachedRate = await prisma.exchangeRate.findFirst({
        where: {
          fromCurrency: fromCurrency as any,
          toCurrency: toCurrency as any,
          timestamp: {
            gte: new Date(Date.now() - this.CACHE_DURATION),
          },
        },
        orderBy: { timestamp: 'desc' },
      });

      if (cachedRate) {
        return parseFloat(cachedRate.rate.toString());
      }

      // If not in cache, fetch from API
      const rates = await this.fetchLatestRates('USD');

      if (rates && rates[fromCurrency] && rates[toCurrency]) {
        // Convert via USD: fromCurrency -> USD -> toCurrency
        // rates[currency] = how many units of that currency = 1 USD
        // So to convert from NGN to USD: amount_ngn / rates['NGN']
        // To convert from USD to target: amount_usd * rates['target']
        const fromRate = rates[fromCurrency];
        const toRate = rates[toCurrency];
        return toRate / fromRate;
      }

      // Fallback to 1 if rate not available
      return 1;
    } catch (error) {
      // Return 1 as fallback if error occurs
      return 1;
    }
  }

  // Update exchange rates manually (for admin use)
  static async updateExchangeRates(): Promise<boolean> {
    try {
      const rates = await this.fetchLatestRates('USD');

      if (rates) {
        await this.cacheRates('USD', rates);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Get rate update status
  static async getRateUpdateStatus(): Promise<{
    lastUpdate: Date | null;
    nextUpdate: Date | null;
    source: string;
    totalRates: number;
  }> {
    try {
      const latestRate = await prisma.exchangeRate.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      const totalRates = await prisma.exchangeRate.count();

      return {
        lastUpdate: latestRate?.timestamp || null,
        nextUpdate: latestRate
          ? new Date(latestRate.timestamp.getTime() + this.CACHE_DURATION)
          : null,
        source: latestRate?.source || 'unknown',
        totalRates,
      };
    } catch (error) {
      return {
        lastUpdate: null,
        nextUpdate: null,
        source: 'unknown',
        totalRates: 0,
      };
    }
  }
}
