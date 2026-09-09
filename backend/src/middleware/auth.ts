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
