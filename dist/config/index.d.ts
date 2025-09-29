interface Config {
    NODE_ENV: string;
    PORT: number;
    API_PREFIX: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRE: string;
    JWT_REFRESH_EXPIRE: string;
    BCRYPT_ROUNDS: number;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    CORS_ORIGIN: string;
    CURRENCY_API_KEY?: string;
    FLUTTERWAVE_SECRET_KEY?: string;
    PAYSTACK_SECRET_KEY?: string;
    ETHEREUM_RPC_URL?: string;
    POLYGON_RPC_URL?: string;
    PRIVATE_KEY?: string;
    SMTP_HOST?: string;
    SMTP_PORT?: number;
    SMTP_USER?: string;
    SMTP_PASS?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
}
declare const config: Config;
export default config;
//# sourceMappingURL=index.d.ts.map