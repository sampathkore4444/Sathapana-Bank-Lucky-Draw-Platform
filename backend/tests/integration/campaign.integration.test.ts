import request from 'supertest';
import express from 'express';

// Mock all middleware before importing routes
jest.mock('../../src/config/database', () => {
  const mockPrisma = {
    campaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    prize: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return { __esModule: true, default: mockPrisma };
});

jest.mock('../../src/config/redis', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  morganStream: {},
  requestLogger: (req: any, res: any, next: any) => next(),
}));

jest.mock('express-rate-limit', () => {
  return () => (req: any, res: any, next: any) => next();
});

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-token'),
  verify: jest.fn(() => ({
    userId: 'user-123',
    email: 'admin@test.com',
    role: 'SUPER_ADMIN',
  })),
  TokenExpiredError: class extends Error {},
}));

// Mock auth middleware
jest.mock('../../src/middleware/auth', () => ({
  __esModule: true,
  default: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      userId: 'user-123',
      email: 'admin@test.com',
      role: 'SUPER_ADMIN',
    };
    next();
  },
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      userId: 'user-123',
      email: 'admin@test.com',
      role: 'SUPER_ADMIN',
    };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
  generateToken: jest.fn(() => 'mock-token'),
  verifyToken: jest.fn(() => ({
    userId: 'user-123',
    email: 'admin@test.com',
    role: 'SUPER_ADMIN',
  })),
}));

// Mock validate middleware
jest.mock('../../src/middleware/validate', () => ({
  __esModule: true,
  validate: () => (req: any, res: any, next: any) => next(),
}));

// Mock sanitization middleware
jest.mock('../../src/middleware/sanitization', () => ({
  __esModule: true,
  sanitizeBody: (req: any, res: any, next: any) => next(),
  sanitizeQuery: (req: any, res: any, next: any) => next(),
  preventSQLInjection: (req: any, res: any, next: any) => next(),
  preventPathTraversal: (req: any, res: any, next: any) => next(),
}));

// Mock security audit middleware
jest.mock('../../src/middleware/securityAudit', () => ({
  __esModule: true,
  auditAuth: (req: any, res: any, next: any) => next(),
  auditSensitiveOps: (req: any, res: any, next: any) => next(),
  detectSuspiciousActivity: (req: any, res: any, next: any) => next(),
  blockSuspiciousIPs: (req: any, res: any, next: any) => next(),
}));

import prisma from '../../src/config/database';
import campaignRouter from '../../src/routes/campaign.routes';

const app = express();
app.use(express.json());
app.use('/campaigns', campaignRouter);

describe('Campaign Integration Tests', () => {
  const mockCampaign = {
    id: 'campaign-1',
    name: 'Smart Savings Lucky Draw',
    description: 'Win amazing prizes',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    drawDate: new Date('2025-12-31'),
    status: 'ACTIVE',
    campaignType: 'TRANSACTION_BASED',
    minTransactionAmount: 150,
    entriesPerTransaction: 1,
    maxEntriesPerCustomer: 100,
    totalBudget: 500000,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /campaigns', () => {
    it('should return list of campaigns', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/campaigns')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should filter campaigns by status', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/campaigns?status=ACTIVE')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /campaigns/:id', () => {
    it('should return campaign by ID', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        prizes: [],
      });

      const response = await request(app)
        .get('/campaigns/campaign-1')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/campaigns/nonexistent')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /campaigns', () => {
    it('should create a new campaign', async () => {
      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/campaigns')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'Smart Savings Lucky Draw',
          description: 'Win amazing prizes',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          drawDate: '2025-12-31',
          campaignType: 'TRANSACTION_BASED',
          minTransactionAmount: 150,
          entriesPerTransaction: 1,
          maxEntriesPerCustomer: 100,
          totalBudget: 500000,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /campaigns/:id/activate', () => {
    it('should activate a draft campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'DRAFT',
      });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/campaigns/campaign-1/activate')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /campaigns/:id/pause', () => {
    it('should pause an active campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
      });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'SCHEDULED',
      });

      const response = await request(app)
        .post('/campaigns/campaign-1/pause')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /campaigns/:id/close', () => {
    it('should close a campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
      });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'CLOSED',
      });

      const response = await request(app)
        .post('/campaigns/campaign-1/close')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
    });
  });
});
