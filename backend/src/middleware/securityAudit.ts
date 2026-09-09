import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Security event types
export enum SecurityEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  AUTHORIZED_ACCESS = 'AUTHORIZED_ACCESS',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT = 'RATE_LIMIT',
  SUSPICIOUS_INPUT = 'SUSPICIOUS_INPUT',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DRAW_EXECUTION = 'DRAW_EXECUTION',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

// Security audit logger
export class SecurityAudit {
  static log(event: SecurityEventType, details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    message?: string;
    metadata?: Record<string, any>;
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details,
    };

    // Log to Winston
    logger.info('Security Event', logEntry);

    // In production, also send to SIEM
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to SIEM (Splunk, ELK, etc.)
      // sendToSIEM(logEntry);
    }
  }
}

// Middleware to log authentication attempts
export function auditAuth(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  
  res.send = function(body) {
    const statusCode = res.statusCode;
    const isLogin = req.path.includes('/login');
    const isRegister = req.path.includes('/register');
    
    if (isLogin || isRegister) {
      const eventType = statusCode === 200 || statusCode === 201
        ? SecurityEventType.AUTH_SUCCESS
        : SecurityEventType.AUTH_FAILURE;
      
      SecurityAudit.log(eventType, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.path,
        method: req.method,
        statusCode,
        message: isLogin ? 'Login attempt' : 'Registration attempt',
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

// Middleware to log sensitive operations
export function auditSensitiveOps(req: Request, res: Response, next: NextFunction) {
  const sensitivePaths = [
    '/draws',
    '/admin',
    '/winners',
  ];
  
  const isSensitive = sensitivePaths.some(path => req.path.includes(path));
  
  if (isSensitive) {
    const originalSend = res.send;
    
    res.send = function(body) {
      SecurityAudit.log(SecurityEventType.DATA_ACCESS, {
        userId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
      });
      
      return originalSend.call(this, body);
    };
  }
  
  next();
}

// Middleware to detect and log suspicious activity
export function detectSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b)/i,
    // XSS attempts
    /<script[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    // Path traversal
    /\.\.\//,
    /~\//,
    // Command injection
    /[;&|`$]/,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    SecurityAudit.log(SecurityEventType.SUSPICIOUS_INPUT, {
      userId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      endpoint: req.path,
      method: req.method,
      message: 'Suspicious input detected',
    });
  }

  next();
}

// Middleware to log draw executions
export function auditDrawExecution(req: Request, res: Response, next: NextFunction) {
  if (req.path.includes('/execute') && req.method === 'POST') {
    const originalSend = res.send;
    
    res.send = function(body) {
      const responseBody = JSON.parse(body);
      
      SecurityAudit.log(SecurityEventType.DRAW_EXECUTION, {
        userId: (req as any).user?.id,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        metadata: {
          campaignId: req.params.campaignId,
          success: responseBody.success,
          drawId: responseBody.data?.drawId,
        },
      });
      
      return originalSend.call(this, body);
    };
  }
  
  next();
}

// IP blocklist (in-memory, should use Redis in production)
const blockedIPs = new Set<string>();
const suspiciousIPs = new Map<string, number>();

// Middleware to block suspicious IPs
export function blockSuspiciousIPs(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || 'unknown';
  
  if (blockedIPs.has(clientIP)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }
  
  next();
}

// Function to track suspicious IPs
export function trackSuspiciousActivity(ip: string) {
  const count = (suspiciousIPs.get(ip) || 0) + 1;
  suspiciousIPs.set(ip, count);
  
  // Block after 10 suspicious activities
  if (count >= 10) {
    blockedIPs.add(ip);
    SecurityAudit.log(SecurityEventType.RATE_LIMIT, {
      ip,
      message: 'IP blocked due to suspicious activity',
    });
  }
}
