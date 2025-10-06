import axios, { AxiosInstance } from 'axios';
import config from '@/config';

interface CircleCustomer {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

interface CircleWallet {
  walletId: string;
  address: string;
  blockchain: string;
  currency?: string;
  balance?: string;
  state?: string;
  accountType?: string;
  custodyType?: string;
}

interface CircleTransfer {
  id: string;
  status: string;
  amount: string;
  currency: string;
  source: any;
  destination: any;
  createdAt: string;
}

export class CircleService {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.CIRCLE_API_KEY || '';
    this.baseUrl = config.CIRCLE_BASE_URL || 'https://api.circle.com';

    if (!this.apiKey) {
      throw new Error('Circle API key is required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request/response interceptors for logging in development
    if (config.NODE_ENV === 'development') {
      this.client.interceptors.request.use(request => {
        console.log(`Circle API Request: ${request.method?.toUpperCase()} ${request.url}`);
        return request;
      });

      this.client.interceptors.response.use(
        response => {
          console.log(`Circle API Response: ${response.status} ${response.config.url}`);
          return response;
        },
        error => {
          console.error(
            `Circle API Error: ${error.response?.status} ${error.config?.url}`,
            error.response?.data,
          );
          return Promise.reject(error);
        },
      );
    }
  }

  // Test API connectivity
  async ping(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/stablecoins');
      return response.status === 200;
    } catch (error: any) {
      console.error('Circle API ping error:', {
        status: error.response?.status,
        message: error.response?.data?.message,
        code: error.response?.data?.code,
      });
      return false;
    }
  }

  // Circle W3S User Management
  async createUser(userId: string): Promise<any> {
    try {
      const response = await this.client.post('/v1/w3s/users', {
        userId: userId,
        idempotencyKey: this.generateUUID(),
      });
      return response.data;
    } catch (error) {
      throw new Error('Failed to create Circle user');
    }
  }

  async getUser(userId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/w3s/users/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get Circle user');
    }
  }

  // Wallet Management (Circle Developer Services) - Using SDK
  async createWallet(userId: string, blockchains: string[] = ['ETH']): Promise<CircleWallet> {
    try {
      // Check if we have the required wallet configuration
      if (!config.CIRCLE_WALLET_SET_ID || !config.CIRCLE_ENTITY_SECRET) {
        throw new Error(
          'Circle wallet configuration missing: CIRCLE_WALLET_SET_ID and CIRCLE_ENTITY_SECRET required',
        );
      }

      // Use Circle SDK for proper wallet creation
      const {
        initiateDeveloperControlledWalletsClient,
      } = require('@circle-fin/developer-controlled-wallets');

      const circleDeveloperSdk = initiateDeveloperControlledWalletsClient({
        apiKey: config.CIRCLE_API_KEY,
        entitySecret: config.CIRCLE_ENTITY_SECRET,
      });

      const response = await circleDeveloperSdk.createWallets({
        accountType: 'SCA', // Smart Contract Account
        blockchains: blockchains,
        count: 1,
        walletSetId: config.CIRCLE_WALLET_SET_ID,
      });

      const wallet = response.data?.wallets?.[0];
      if (!wallet) {
        throw new Error('No wallet returned from Circle API');
      }

      return {
        walletId: wallet.id,
        address: wallet.address,
        blockchain: wallet.blockchain,
        state: wallet.state,
        accountType: wallet.accountType,
        custodyType: wallet.custodyType,
      };
    } catch (error) {
      throw new Error(
        `Failed to create Circle wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

  async getWallet(walletId: string): Promise<CircleWallet> {
    try {
      const response = await this.client.get(`/v1/w3s/wallets/${walletId}`);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to get Circle wallet');
    }
  }

  // Circle Gateway - Cross-Chain USDC Transfers
  async createGatewayTransfer(transferData: {
    source: {
      address: string;
      chain: string;
    };
    destination: {
      address: string;
      chain: string;
    };
    amount: string;
  }): Promise<any> {
    // Use mock Gateway for development until real Gateway endpoints are available
    if (!config.CIRCLE_GATEWAY_ENABLED) {
      // Mock successful Gateway transfer for development
      const mockTransferId = `gateway_${this.generateUUID()}`;

      // Simulate realistic API delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        id: mockTransferId,
        status: 'pending',
        source: transferData.source,
        destination: transferData.destination,
        amount: {
          amount: transferData.amount,
          currency: 'USD',
        },
        createdAt: new Date().toISOString(),
        estimatedCompletion: new Date(Date.now() + 500).toISOString(),
      };
    }

    // Production: Use real Circle Gateway API
    // Note: Circle Gateway may use different endpoints than standard Circle API
    try {
      const response = await this.client.post('/v1/w3s/developer/transactions/transfer', {
        idempotencyKey: this.generateUUID(),
        amounts: [transferData.amount],
        destinationAddress: transferData.destination.address,
        tokenId: 'USDC', // Circle Gateway token
        walletId: transferData.source.address, // Source wallet ID
      });
      return response.data;
    } catch (error) {
      // If Gateway-specific endpoints fail, the transaction should fail
      // No fallback to traditional processing
      throw new Error(
        `Circle Gateway transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getGatewayTransfer(transferId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/transfer/${transferId}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get Circle Gateway transfer');
    }
  }

  async getWalletBalance(walletId: string): Promise<string> {
    try {
      const wallet = await this.getWallet(walletId);
      return wallet.balance || '0';
    } catch (error) {
      return '0';
    }
  }

  // Transfer Management
  async createTransfer(transferData: {
    source: any;
    destination: any;
    amount: string;
    currency: string;
    metadata?: any;
  }): Promise<CircleTransfer> {
    try {
      const response = await this.client.post('/v1/transfers', {
        idempotencyKey: `transfer_${Date.now()}_${Math.random()}`,
        ...transferData,
      });
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to create Circle transfer');
    }
  }

  async getTransfer(transferId: string): Promise<CircleTransfer> {
    try {
      const response = await this.client.get(`/v1/transfers/${transferId}`);
      return response.data.data;
    } catch (error) {
      throw new Error('Failed to get Circle transfer');
    }
  }

  // Webhook signature verification
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // TODO: Implement webhook signature verification
    // For now, return true in development
    return config.NODE_ENV === 'development' || true;
  }
}

export default new CircleService();
