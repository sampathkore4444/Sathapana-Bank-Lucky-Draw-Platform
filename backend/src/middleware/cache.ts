import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyPrefix?: string;
}

export const cache = (options: CacheOptions = {}) => {
  const { ttl = 300, keyPrefix = 'cache' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Generate cache key
    const userId = (req as any).user?.userId || 'anonymous';
    const cacheKey = `${keyPrefix}:${req.originalUrl}:${userId}`;

    try {
      // Try to get cached response
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        res.status(data.statusCode).json(data.body);
        return;
      }

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = (body: any) => {
        // Cache the response
        const cacheData = {
          statusCode: res.statusCode,
          body,
        };
        redis.set(cacheKey, JSON.stringify(cacheData), ttl).catch(() => {});
        
        return originalJson(body);
      };

      next();
    } catch (error) {
      next();
    }
  };
};

export const invalidateCache = (patterns: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      // Invalidate cache patterns after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(async (pattern) => {
          try {
            const keys = await redis.get(pattern);
            if (keys) {
              await redis.del(pattern);
            }
          } catch (error) {
            // Ignore cache invalidation errors
          }
        });
      }
      
      return originalJson(body);
    };

    next();
  };
};
