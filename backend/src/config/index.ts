import dotenv from 'dotenv';
import path from 'path';
import { isPlaceholderCredential } from '../utils/security';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  jwtCustomerExpiresIn: process.env.JWT_CUSTOMER_EXPIRES_IN || '15m',

  // Core Banking
  coreBankingApiUrl: process.env.CORE_BANKING_API_URL,
  coreBankingApiKey: process.env.CORE_BANKING_API_KEY,
  coreBankingWebhookSecret: process.env.CORE_BANKING_WEBHOOK_SECRET || 'change-me',

  // USSD
  ussdGatewaySecret: process.env.USSD_GATEWAY_SECRET || 'change-me',

  // SMS
  smsGatewayUrl: process.env.SMS_GATEWAY_URL,
  smsGatewayApiKey: process.env.SMS_GATEWAY_API_KEY,
  smsSender: process.env.SMS_GATEWAY_SENDER || 'SATHAPANA',

  // Email
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',

  // Proxy
  trustProxy: process.env.TRUST_PROXY === 'true' ? 1 : false,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Scheduler
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
  schedulerIntervalMinutes: parseInt(process.env.SCHEDULER_INTERVAL_MINUTES || '5', 10),
  winnerExpiryDays: parseInt(process.env.WINNER_EXPIRY_DAYS || '7', 10),
};

/**
 * Refuse to boot in production with default / placeholder secrets or a missing
 * database URL. This prevents deploying with known credential strings.
 */
function validateConfig() {
  if (config.nodeEnv !== 'production') return;

  const failures: string[] = [];

  if (isPlaceholderCredential(config.jwtSecret)) {
    failures.push('JWT_SECRET must be set to a strong secret');
  }
  if (isPlaceholderCredential(config.coreBankingWebhookSecret)) {
    failures.push('CORE_BANKING_WEBHOOK_SECRET must be set to a strong secret');
  }
  if (isPlaceholderCredential(config.ussdGatewaySecret)) {
    failures.push('USSD_GATEWAY_SECRET must be set to a strong secret');
  }
  if (!config.databaseUrl) {
    failures.push('DATABASE_URL must be set');
  }

  if (failures.length > 0) {
    throw new Error(`Invalid production configuration: ${failures.join('; ')}`);
  }
}

validateConfig();
