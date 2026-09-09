import winston from 'winston';
import path from 'path';
import { config } from './index';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'sathapana-luckydraw' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: config.nodeEnv === 'production' ? logFormat : consoleFormat,
    }),

    // File transport for errors
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // File transport for combined logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Create a stream for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Request logger middleware
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

// Error logger middleware
export const errorLogger = (err: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });
  
  next(err);
};

// Security event logger
export const securityLogger = {
  loginAttempt: (email: string, success: boolean, ip: string) => {
    logger.info('Login attempt', {
      email,
      success,
      ip,
      eventType: 'LOGIN_ATTEMPT',
    });
  },

  unauthorizedAccess: (userId: string, resource: string, ip: string) => {
    logger.warn('Unauthorized access attempt', {
      userId,
      resource,
      ip,
      eventType: 'UNAUTHORIZED_ACCESS',
    });
  },

  suspiciousActivity: (description: string, ip: string, metadata?: any) => {
    logger.warn('Suspicious activity detected', {
      description,
      ip,
      metadata,
      eventType: 'SUSPICIOUS_ACTIVITY',
    });
  },
};

// Business event logger
export const businessLogger = {
  campaignCreated: (campaignId: string, name: string, createdBy: string) => {
    logger.info('Campaign created', {
      campaignId,
      name,
      createdBy,
      eventType: 'CAMPAIGN_CREATED',
    });
  },

  drawExecuted: (drawId: string, campaignId: string, totalWinners: number) => {
    logger.info('Draw executed', {
      drawId,
      campaignId,
      totalWinners,
      eventType: 'DRAW_EXECUTED',
    });
  },

  winnerSelected: (winnerId: string, customerId: string, prizeName: string) => {
    logger.info('Winner selected', {
      winnerId,
      customerId,
      prizeName,
      eventType: 'WINNER_SELECTED',
    });
  },
};
