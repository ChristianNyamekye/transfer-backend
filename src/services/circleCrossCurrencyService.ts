import axios, { AxiosInstance } from 'axios';
import config from '@/config';

export interface CrossCurrencyQuote {
  id: string;
  rate: number;
  from: {
    currency: string;
    amount: number;
  };
  to: {
    currency: string;
    amount: number;
  };
  expiry: string;
  type: string;
}

export interface CrossCurrencyTrade {
  id: string;
  from: {
    currency: string;
    amount: number;
  };
  to: {
    currency: string;
    amount: number;
  };
  status: string;
  quoteId: string;
  createDate: string;
  updateDate: string;
}

export class CircleCrossCurrencyService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.CIRCLE_API_KEY || '';
    // Use sandbox for development, mainnet for production
    this.baseUrl =
      config.CIRCLE_ENVIRONMENT === 'production'
        ? 'https://api.circle.com'
        : 'https://api-sandbox.circle.com';

    if (!this.apiKey) {
      throw new Error('Circle API key is required for Cross-Currency API');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging
    if (config.NODE_ENV === 'development') {
      this.client.interceptors.request.use(request => {
        console.log(
          `Circle Cross-Currency Request: ${request.method?.toUpperCase()} ${request.url}`,
        );
        return request;
      });

      this.client.interceptors.response.use(
        response => {
          console.log(`Circle Cross-Currency Response: ${response.status} ${response.config.url}`);
          return response;
        },
        error => {
          console.error(
            `Circle Cross-Currency Error: ${error.response?.status} ${error.config?.url}`,
            error.response?.data,
          );
          return Promise.reject(error);
        },
      );
    }
  }

  // Get linked fiat accounts
  async getLinkedFiatAccounts(): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/businessAccount/banks');
      return response.data.data || [];
    } catch (error) {
      throw new Error('Failed to get linked fiat accounts');
    }
  }

  // Request a quote for local currency → USDC
  async requestQuote(fromCurrency: string, fromAmount: number): Promise<CrossCurrencyQuote> {
    try {
      const idempotencyKey = this.generateUUID();

      const response = await this.client.post('/v1/exchange/quotes', {
        type: 'tradable',
        idempotencyKey,
        from: {
          currency: fromCurrency,
          amount: fromAmount,
        },
        to: {
          currency: 'USDC',
          amount: null,
        },
      });

      return response.data.data;
    } catch (error) {
      throw new Error(
        `Failed to request quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Create a trade (accept quote and lock rate)
  async createTrade(quoteId: string): Promise<CrossCurrencyTrade> {
    try {
      const idempotencyKey = this.generateUUID();

      const response = await this.client.post('/v1/exchange/trades', {
        idempotencyKey,
        quoteId,
      });

      return response.data.data;
    } catch (error) {
      throw new Error(
        `Failed to create trade: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Get settlement batches (pending payments)
  async getSettlementBatches(): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/exchange/trades/settlements');
      return response.data.data || [];
    } catch (error) {
      throw new Error('Failed to get settlement batches');
    }
  }

  // Get payment instructions for a currency
  async getPaymentInstructions(currency: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/v1/exchange/trades/settlements/instructions/${currency}`,
      );
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get payment instructions for ${currency}`);
    }
  }

  // Generate UUID for idempotency keys
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export default new CircleCrossCurrencyService();
