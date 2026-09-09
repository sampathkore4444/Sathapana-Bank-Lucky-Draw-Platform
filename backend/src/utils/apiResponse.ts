import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types';

export class ApiResponseHelper {
  static success<T>(res: Response, data: T, message?: string, statusCode = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
    };
    res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message?: string): void {
    this.success(res, data, message || 'Created successfully', 201);
  }

  static error(res: Response, message: string, statusCode = 400): void {
    const response: ApiResponse = {
      success: false,
      error: message,
    };
    res.status(statusCode).json(response);
  }

  static notFound(res: Response, resource = 'Resource'): void {
    this.error(res, `${resource} not found`, 404);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): void {
    this.error(res, message, 401);
  }

  static forbidden(res: Response, message = 'Forbidden'): void {
    this.error(res, message, 403);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
    message?: string
  ): void {
    const totalPages = Math.ceil(total / limit);
    const response: ApiResponse<T[]> = {
      success: true,
      data,
      message,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
    res.status(200).json(response);
  }
}
