import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthRequest, JwtPayload } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ApiResponseHelper.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    if (!decoded.role && !decoded.userId && !decoded.customerId) {
      ApiResponseHelper.unauthorized(res, 'Invalid token payload');
      return;
    }
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      ApiResponseHelper.unauthorized(res, 'Token expired');
    } else {
      ApiResponseHelper.unauthorized(res, 'Invalid token');
    }
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      ApiResponseHelper.unauthorized(res, 'Not authenticated');
      return;
    }

    if (!roles.includes(req.user.role)) {
      ApiResponseHelper.forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  } as jwt.SignOptions);
};

export const generateCustomerToken = (customerId: string): string => {
  return jwt.sign(
    { role: 'CUSTOMER', customerId },
    config.jwtSecret,
    { expiresIn: config.jwtCustomerExpiresIn as string } as jwt.SignOptions
  );
};

export const isCustomer = (user: JwtPayload | undefined): boolean => user?.role === 'CUSTOMER';

/**
 * Resolve the target customer identity for a request:
 * - CUSTOMER tokens: the customerId is taken from the signed token only
 *   (never from headers/query, preventing IDOR via client-supplied values).
 * - Staff tokens: the customerId is taken from the X-Customer-Id header or
 *   customerId query parameter (staff may look up customers on their behalf).
 */
export const resolveCustomer = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    ApiResponseHelper.unauthorized(res, 'Not authenticated');
    return;
  }

  if (isCustomer(req.user)) {
    if (!req.user.customerId) {
      ApiResponseHelper.unauthorized(res, 'Invalid customer token');
      return;
    }
    req.customerId = req.user.customerId;
    next();
    return;
  }

  const header = req.headers['x-customer-id'];
  const supplied = header ? String(header) : typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
  if (!supplied) {
    ApiResponseHelper.unauthorized(res, 'X-Customer-Id header or customerId query parameter required');
    return;
  }
  req.customerId = supplied;
  next();
};
