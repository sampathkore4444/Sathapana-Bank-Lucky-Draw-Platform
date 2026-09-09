import prisma from '../config/database';
import { redis } from '../config/redis';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
    memory: MemoryStatus;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
}

interface MemoryStatus {
  status: 'ok' | 'warning' | 'critical';
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

export class HealthCheckService {
  async check(): Promise<HealthStatus> {
    const [databaseStatus, cacheStatus] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkCache(),
    ]);

    const memoryStatus = this.checkMemory();
    
    const services = {
      database: databaseStatus.status === 'fulfilled' ? databaseStatus.value : { status: 'down' as const, error: 'Health check failed' },
      cache: cacheStatus.status === 'fulfilled' ? cacheStatus.value : { status: 'down' as const, error: 'Health check failed' },
      memory: memoryStatus,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (services.database.status === 'down' || services.memory.status === 'critical') {
      overallStatus = 'unhealthy';
    } else if (services.database.status === 'degraded' || services.cache.status === 'down' || services.memory.status === 'warning') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      services,
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkCache(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const result = await redis.get('health:check');
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error: any) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private checkMemory(): MemoryStatus {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    
    if (heapUsedMB > 500) {
      status = 'critical';
    } else if (heapUsedMB > 300) {
      status = 'warning';
    }

    return {
      status,
      heapUsed: Math.round(heapUsedMB * 100) / 100,
      heapTotal: Math.round(heapTotalMB * 100) / 100,
      rss: Math.round(rssMB * 100) / 100,
      external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
    };
  }
}

export const healthCheck = new HealthCheckService();
