import { Request, Response, NextFunction } from 'express';

// Sanitize string inputs to prevent XSS
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Recursively sanitize object
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// Middleware to sanitize request body
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

// Middleware to sanitize query parameters
export function sanitizeQuery(req: Request, res: Response, next: NextFunction) {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

// SQL injection prevention (additional layer beyond Prisma)
export function preventSQLInjection(req: Request, res: Response, next: NextFunction) {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FETCH|DECLARE|TRUNCATE|COMMENT)\b)/i,
    /(--|;|\/\*|\*\/|xp_|sp_)/i,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(CHAR\(|CONCAT\(|0x[0-9a-f]+)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected',
    });
  }

  next();
}

// Path traversal prevention
export function preventPathTraversal(req: Request, res: Response, next: NextFunction) {
  const pathPatterns = [/\.\./, /~\//, /\/etc\/passwd/, /\/etc\/shadow/];
  
  const checkPath = (path: string): boolean => {
    return pathPatterns.some(pattern => pattern.test(path));
  };

  if (checkPath(req.path) || checkPath(req.url)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid path detected',
    });
  }

  next();
}

// Request size limiter
export function requestSizeLimiter(maxSize: number = 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
      });
    }
    
    next();
  };
}

// Header validation
export function validateHeaders(req: Request, res: Response, next: NextFunction) {
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-forwarded-host'];
  
  for (const header of suspiciousHeaders) {
    const value = req.headers[header];
    if (value && typeof value === 'string') {
      // Basic validation - should be IP format
      const ipPattern = /^[\d.:]+$/;
      if (!ipPattern.test(value)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid header value',
        });
      }
    }
  }
  
  next();
}
