import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import config from '@/config';

export interface RampnowCreateSessionParams {
  amount: number;
  currency: string; // fiat currency user pays with (e.g., USD)
  destinationAddress: string; // wallet address to receive USDC
  destinationNetwork: string; // e.g., ETH, POLYGON, SOL, etc.
  destinationAsset?: string; // e.g., USDC
  externalOrderUid: string; // Unique order identifier from our system
  userEmail: string;
  userFirstName?: string;
  userLastName?: string;
  userPhone?: string;
  userDateOfBirth?: string; // Required for checkout: ISO8601 datetime format (e.g., '1990-01-01T00:00:00Z')
  userGender?: string; // Required for checkout: 'male', 'female', or 'unknown'
  userCountry?: string; // Required for checkout: ISO country code (e.g., 'US', 'GB', 'GH')
  userAddress?: {
    // Optional address details
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  paymentMode?: string; // Optional: 'card', 'google_pay', 'apple_pay', 'sofort', etc.
  walletAddressTag?: string; // Optional wallet tag/memo
  returnUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface RampnowSession {
  id: string;
  status: string;
  checkoutUrl?: string;
  clientToken?: string;
  createdAt?: string;
}

export class RampnowService {
  private client: AxiosInstance;
  private apiKey: string;
  private secretKey: string;

  constructor() {
    if (!config.RAMPNOW_API_KEY) {
      throw new Error('RAMPNOW_API_KEY is required. Check your .env file.');
    }
    if (!config.RAMPNOW_SECRET_KEY) {
      throw new Error(
        'RAMPNOW_SECRET_KEY is required for HMAC signature authentication. Check your .env file.',
      );
    }

    this.apiKey = config.RAMPNOW_API_KEY?.trim() || '';

    // Secret key - trim whitespace and fix common .env issues
    let secretKey = config.RAMPNOW_SECRET_KEY?.trim() || '';

    // Fix common .env file issues:
    // 1. Remove leading = if accidentally added (e.g., RAMPNOW_SECRET_KEY==sk_...)
    if (secretKey.startsWith('=')) {
      console.warn(
        '⚠️  WARNING: Secret key starts with = sign, removing it. Please fix your .env file!',
      );
      secretKey = secretKey.substring(1);
    }

    // 2. Remove quotes if present
    if (
      (secretKey.startsWith('"') && secretKey.endsWith('"')) ||
      (secretKey.startsWith("'") && secretKey.endsWith("'"))
    ) {
      secretKey = secretKey.slice(1, -1);
    }

    this.secretKey = secretKey;

    this.client = axios.create({
      // Production: https://api.rampnow.io
      // Sandbox: https://api.dev.rampnow.io
      baseURL: config.RAMPNOW_BASE_URL || 'https://api.dev.rampnow.io',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
      // CRITICAL: We must stringify the body BEFORE the interceptor runs
      // so the signature is calculated on the exact string that will be sent
      transformRequest: [
        (data, headers) => {
          // If data is an object, stringify it with consistent formatting
          if (data && typeof data === 'object') {
            // Use JSON.stringify with no spaces to ensure consistent format
            return JSON.stringify(data);
          }
          return data;
        },
      ],
    });

    // Add request interceptor to generate HMAC signature for each request
    this.client.interceptors.request.use(
      config => {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const method = (config.method || 'GET').toUpperCase();
        const path = config.url || '';
        const body = config.data || '';

        // Signature string format: timestamp + method + path + body
        const signString = timestamp + method + path + body;

        // Generate HMAC-SHA256 signature
        const signature = crypto
          .createHmac('sha256', this.secretKey)
          .update(signString, 'utf8')
          .digest('hex')
          .toLowerCase();

        // Add authentication headers
        config.headers = config.headers || {};
        config.headers['X-RAMPNOW-API-KEY'] = this.apiKey;
        config.headers['X-RAMPNOW-TIMESTAMP'] = timestamp;
        config.headers['X-RAMPNOW-SIGN'] = signature;

        // Log signature details only in development (with redacted sensitive data)
        if (process.env.NODE_ENV === 'development') {
          console.log('Rampnow API request:', {
            method,
            path,
            bodyLength: typeof body === 'string' ? body.length : JSON.stringify(body).length,
          });
        }

        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    // Response interceptor - only log errors
    this.client.interceptors.response.use(
      response => response,
      error => {
        // Log errors for debugging
        if (process.env.NODE_ENV === 'development') {
          console.error('Rampnow API error:', error.response?.status, error.response?.data?.message || error.message);
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * Verify webhook signature from Rampnow
   */
  static verifyWebhookSignature(rawBody: string, signature?: string): boolean {
    if (!signature || !config.RAMPNOW_WEBHOOK_SECRET) {
      // In development, allow bypassing signature verification
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Webhook signature verification bypassed in development mode');
        return true;
      }
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.RAMPNOW_WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex')
      .toLowerCase();

    return signature.toLowerCase() === expectedSignature.toLowerCase();
  }

  /**
   * Create Widget Mode URL directly (no API call needed)
   * This is the simplest integration and works in sandbox
   * NOTE: Widget Mode cannot pre-fill KYC fields due to compliance requirements
   */
  createWidgetModeUrl(params: RampnowCreateSessionParams): string {
    // Map chain names for widget URL
    const chainMap: Record<string, string> = {
      ETH: 'ethereum',
      ETHEREUM: 'ethereum',
      POLYGON: 'polygon',
      POLY: 'polygon',
      MATIC: 'polygon',
    };

    const dstChain =
      chainMap[params.destinationNetwork.toUpperCase()] || params.destinationNetwork.toLowerCase();

    // Widget Mode URL: https://app.rampnow.io/order/quote?apiKey=...&params...
    // NOTE: We cannot pre-fill personal/KYC fields (name, DOB, address) due to compliance
    // But we can pre-fill transaction details
    const widgetUrl = new URL('https://app.rampnow.io/order/quote');
    widgetUrl.searchParams.set('apiKey', this.apiKey);
    widgetUrl.searchParams.set('orderType', 'buy');
    widgetUrl.searchParams.set('srcCurrency', params.currency.toUpperCase());
    widgetUrl.searchParams.set('srcAmount', params.amount.toString());
    widgetUrl.searchParams.set('srcChain', 'fiat');
    widgetUrl.searchParams.set('dstCurrency', params.destinationAsset?.toUpperCase() || 'USDC');
    widgetUrl.searchParams.set('dstChain', dstChain);
    widgetUrl.searchParams.set('walletAddress', params.destinationAddress);
    if (params.externalOrderUid) {
      widgetUrl.searchParams.set('externalOrderId', params.externalOrderUid);
    }
    if (params.returnUrl) {
      widgetUrl.searchParams.set('returnUrl', params.returnUrl);
    }

    return widgetUrl.toString();
  }

  /**
   * Create Hosted Mode order (requires KYC Share setup first)
   * This allows you to collect KYC info in your own UI and display payment details
   * Contact admin@rampnow.io to set up KYC Share with Sumsub first
   */
  async createHostedOrder(params: RampnowCreateSessionParams): Promise<RampnowSession> {
    const endpoint = '/api/partner/v1/ext/ramp_order/hosted';

    // Map chain names to Rampnow format
    const chainMap: Record<string, string> = {
      ETH: 'ethereum',
      ETHEREUM: 'ethereum',
      POLYGON: 'polygon',
      POLY: 'polygon',
      MATIC: 'polygon',
      TRON: 'tron',
      EOS: 'eos',
      'INTERNET-COMPUTER': 'internet-computer',
    };

    const dstChain =
      chainMap[params.destinationNetwork.toUpperCase()] || params.destinationNetwork.toLowerCase();
    const srcChain = 'fiat'; // For buy orders

    const currencyMap: Record<string, string> = {
      USD: 'USD',
      EUR: 'EUR',
      GBP: 'GBP',
      GHS: 'GHS',
      NGN: 'NGN',
      KES: 'KES',
      ZAR: 'ZAR',
      USDC: 'USDC',
    };

    const srcCurrency = currencyMap[params.currency.toUpperCase()] || params.currency.toUpperCase();
    const dstCurrency = params.destinationAsset?.toUpperCase() || 'USDC';

    // Hosted order request body - simpler than checkout
    const requestBody: any = {
      externalOrderUid: params.externalOrderUid,
      orderType: 'buy',
      paymentMode: params.paymentMode || 'card',
      srcAmount: params.amount.toString(),
      srcChain: srcChain,
      srcCurrency: srcCurrency,
      dstChain: dstChain,
      dstCurrency: dstCurrency,
      userEmail: params.userEmail, // Hosted mode uses email only (user must be onboarded via KYC Share first)
      wallet: {
        address: params.destinationAddress,
        addressTag: params.walletAddressTag || '',
        custodyType: 'unhosted',
      },
    };

    if (params.returnUrl) {
      requestBody.returnUrl = params.returnUrl;
    }
    if (params.webhookUrl) {
      requestBody.webhookUrl = params.webhookUrl;
    }

    try {
      const { data } = await this.client.post(endpoint, requestBody);

      if (data?.code === 1 && data?.data) {
        return {
          id: data.data.orderUid || params.externalOrderUid,
          status: data.data.status || 'pending',
          checkoutUrl: data.data.redirectUrl, // Hosted mode may return redirectUrl for payment
          clientToken: undefined,
          createdAt: new Date().toISOString(),
        };
      }

      throw new Error(`Rampnow API error (${data?.code}): ${data?.message || 'Unknown error'}`);
    } catch (error: any) {
      const errorResponse = error.response?.data;
      throw new Error(
        `Rampnow hosted order creation failed: ${errorResponse?.message || error.message}`,
      );
    }
  }

  /**
   * Create onramp session using Rampnow
   *
   * Since checkout endpoint requires account configuration that may not be available in sandbox,
   * we can also provide a Widget Mode URL directly (no API call needed)
   */
  async createOnrampSession(params: RampnowCreateSessionParams): Promise<RampnowSession> {
    // Try checkout endpoint first (requires API key permissions)
    // If it fails with order_mode_not_allowed_err, we'll fall back to Widget Mode URL
    const endpoint = '/api/partner/v1/ext/ramp_order/checkout';

    // Map chain names to Rampnow format (ethereum, polygon, etc.)
    const chainMap: Record<string, string> = {
      ETH: 'ethereum',
      ETHEREUM: 'ethereum',
      POLYGON: 'polygon',
      POLY: 'polygon',
      MATIC: 'polygon',
      TRON: 'tron',
      EOS: 'eos',
      'INTERNET-COMPUTER': 'internet-computer',
    };

    const dstChain =
      chainMap[params.destinationNetwork.toUpperCase()] || params.destinationNetwork.toLowerCase();

    // CRITICAL: For buy orders (onramp), srcChain must be 'fiat', not the blockchain!
    // From docs: "srcChain: buy - fiat, sell - ethereum"
    const srcChain = 'fiat';

    // Map currency codes - Rampnow uses specific currency codes
    // Note: USDC might be represented differently, check their docs
    const currencyMap: Record<string, string> = {
      USD: 'USD',
      EUR: 'EUR',
      GBP: 'GBP',
      GHS: 'GHS',
      NGN: 'NGN',
      KES: 'KES',
      ZAR: 'ZAR',
      USDC: 'USDC', // May need adjustment based on Rampnow's crypto currency codes
    };

    const srcCurrency = currencyMap[params.currency.toUpperCase()] || params.currency.toUpperCase();
    const dstCurrency = params.destinationAsset?.toUpperCase() || 'USDC';

    // Build request body according to Rampnow checkout API spec
    // Required fields: externalOrderUid, orderType, srcAmount, srcChain, srcCurrency, user, dstChain, dstCurrency
    const requestBody: any = {
      externalOrderUid: params.externalOrderUid,
      orderType: 'buy', // Required enum: 'buy' | 'sell' | 'swap' | 'bridge' | 'refill'
      srcAmount: params.amount.toString(),
      srcChain: srcChain, // For buy: 'fiat'
      srcCurrency: srcCurrency,
      user: {
        // Required user object with all fields
        email: params.userEmail,
        firstName: params.userFirstName || '',
        lastName: params.userLastName || '',
        phone: params.userPhone || '',
        dateOfBirth: params.userDateOfBirth || '1990-01-01T00:00:00Z',
        gender: (params.userGender as 'male' | 'female' | 'unknown') || 'unknown',
        address: {
          // Address object with required fields - provide defaults if missing
          country: params.userCountry || 'US',
          line1: params.userAddress?.line1 || 'N/A', // Required - use 'N/A' if not provided
          line2: params.userAddress?.line2 || '',
          city: params.userAddress?.city || 'N/A', // Required - use 'N/A' if not provided
          state: params.userAddress?.state || '',
          postalCode: params.userAddress?.postalCode || '00000', // Required - use default if not provided
          subDivision: '',
        },
      },
      dstChain: dstChain, // Destination blockchain
      dstCurrency: dstCurrency,
    };

    // Optional fields
    if (params.returnUrl) {
      requestBody.returnUrl = params.returnUrl;
    }
    if (params.webhookUrl) {
      requestBody.webhookUrl = params.webhookUrl;
    }
    // paymentMode is optional for checkout
    if (params.paymentMode) {
      requestBody.paymentMode = params.paymentMode;
    }
    // wallet is optional but recommended
    if (params.destinationAddress) {
      requestBody.wallet = {
        address: params.destinationAddress,
        addressTag: params.walletAddressTag || '',
        custodyType: 'unhosted', // External wallets are unhosted
      };
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('Creating Rampnow order:', endpoint);
      }

      const { data } = await this.client.post(endpoint, requestBody);

      // Handle Rampnow checkout response structure
      // Checkout endpoint: { code: 1, data: { orderUid, redirectUrl } }
      if (data?.code === 1 && data?.data) {
        const orderUid = data.data.orderUid || params.externalOrderUid;
        const redirectUrl = data.data.redirectUrl;

        if (!redirectUrl) {
          throw new Error(
            `Rampnow checkout order created but no redirectUrl in response: ${JSON.stringify(data)}`,
          );
        }

        return {
          id: orderUid,
          status: 'pending',
          checkoutUrl: redirectUrl,
          clientToken: undefined,
          createdAt: new Date().toISOString(),
        };
      }

      // Handle error responses
      if (data?.code && data?.code !== 1) {
        const errorMsg = data.message || 'Unknown error';
        throw new Error(`Rampnow API error (${data.code}): ${errorMsg}`);
      }

      // Unexpected response structure
      throw new Error(`Unexpected Rampnow response structure: ${JSON.stringify(data)}`);
    } catch (error: any) {
      const errorResponse = error.response?.data;
      const errorStatus = error.response?.status;
      const errorCode = errorResponse?.code;
      const errorMessage = errorResponse?.message;

      // Log detailed error only in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Rampnow API error:', {
          status: errorStatus,
          code: errorCode,
          message: errorMessage,
          traceId: errorResponse?.traceId,
        });
      }

      // Provide helpful error messages based on Rampnow error codes
      if (errorStatus === 401) {
        if (errorCode === 100002 || errorMessage?.includes('timestamp')) {
          throw new Error(
            `Rampnow timestamp error: ${errorMessage}. Check server clock synchronization.`,
          );
        } else if (errorMessage?.includes('sign') || errorMessage?.includes('signature')) {
          throw new Error(
            `Rampnow signature error: ${errorMessage}. Check your API key and secret key.`,
          );
        } else {
          throw new Error(
            `Rampnow authentication failed: ${errorMessage || 'Invalid API key or secret key'}`,
          );
        }
      } else if (errorStatus === 400) {
        // If order_mode_not_allowed_err, this indicates checkout endpoint isn't enabled
        // Return a special error that can be caught to use Widget Mode instead
        if (errorCode === 100004 || errorMessage?.includes('order_mode_not_allowed')) {
          const widgetModeError = new Error('CHECKOUT_MODE_NOT_AVAILABLE');
          (widgetModeError as any).shouldUseWidgetMode = true;
          throw widgetModeError;
        }
        throw new Error(
          `Rampnow validation error: ${errorMessage || JSON.stringify(errorResponse)}`,
        );
      } else if (errorResponse) {
        throw new Error(
          `Rampnow API error (${errorCode || errorStatus}): ${errorMessage || JSON.stringify(errorResponse)}`,
        );
      }
      throw error;
    }
  }
}
