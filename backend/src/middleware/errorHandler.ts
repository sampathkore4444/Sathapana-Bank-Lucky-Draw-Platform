import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../utils/apiResponse';
import { config } from '../config';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    ApiResponseHelper.error(res, err.message, err.statusCode);
    return;
  }

  // Prisma errors
  if (err.message.includes('Unique constraint')) {
    ApiResponseHelper.error(res, 'Resource already exists', 409);
    return;
  }

  if (err.message.includes('Record to update not found')) {
    ApiResponseHelper.error(res, 'Resource not found', 404);
    return;
  }

  // Default server error
  const message = config.nodeEnv === 'development' ? err.message : 'Internal server error';
  ApiResponseHelper.error(res, message, 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  ApiResponseHelper.error(res, `Route ${req.method} ${req.path} not found`, 404);
};
