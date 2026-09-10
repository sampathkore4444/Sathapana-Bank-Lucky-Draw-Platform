import dotenv from 'dotenv';
import path from 'path';

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

  // Core Banking
  coreBankingApiUrl: process.env.CORE_BANKING_API_URL,
  coreBankingApiKey: process.env.CORE_BANKING_API_KEY,
  coreBankingWebhookSecret: process.env.CORE_BANKING_WEBHOOK_SECRET || 'change-me',

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

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Scheduler
  schedulerEnabled: process.env.SCHEDULER_ENABLED !== 'false',
  schedulerIntervalMinutes: parseInt(process.env.SCHEDULER_INTERVAL_MINUTES || '5', 10),
  winnerExpiryDays: parseInt(process.env.WINNER_EXPIRY_DAYS || '7', 10),
};
