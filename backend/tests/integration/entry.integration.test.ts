import request from 'supertest';
import express from 'express';

// Mock all middleware before importing routes
jest.mock('../../src/config/database', () => {
  const mockPrisma = {
    customerEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    campaign: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
    email: 'customer@test.com',
    role: 'CUSTOMER',
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
      email: 'customer@test.com',
      role: 'CUSTOMER',
    };
    next();
  },
  authenticate: (req: any, res: any, next: any) => {
    req.user = {
      id: 'user-123',
      userId: 'user-123',
      email: 'customer@test.com',
      role: 'CUSTOMER',
    };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
  generateToken: jest.fn(() => 'mock-token'),
  verifyToken: jest.fn(() => ({
    userId: 'user-123',
    email: 'customer@test.com',
    role: 'CUSTOMER',
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
import entryRouter from '../../src/routes/entry.routes';

const app = express();
app.use(express.json());
app.use('/entries', entryRouter);

describe('Entry Integration Tests', () => {
  const mockCampaign = {
    id: 'campaign-1',
    name: 'Test Campaign',
    status: 'ACTIVE',
    campaignType: 'TRANSACTION_BASED',
    minTransactionAmount: 100,
    entriesPerTransaction: 1,
    maxEntriesPerCustomer: 50,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    entryRules: [{ trigger: 'DEPOSIT', entriesPerAction: 1 }],
  };

  const mockEntry = {
    id: 'entry-1',
    customerId: 'user-123',
    campaignId: 'campaign-1',
    transactionId: 'TXN-123456',
    transactionAmount: 150,
    entriesEarned: 1,
    status: 'APPROVED',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /entries', () => {
    it('should register a new entry', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.customerEntry.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { entriesEarned: 0 } });
      (prisma.customerEntry.create as jest.Mock).mockResolvedValue(mockEntry);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/entries')
        .set('Authorization', 'Bearer mock-token')
        .send({
          customerId: 'user-123',
          campaignId: 'campaign-1',
          entryType: 'DEPOSIT',
          triggerTransactionId: 'TXN-123456',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/entries')
        .set('Authorization', 'Bearer mock-token')
        .send({
          customerId: 'user-123',
          campaignId: 'nonexistent',
          entryType: 'DEPOSIT',
          triggerTransactionId: 'TXN-123456',
        });

      expect(response.status).toBe(404);
    });

    it('should return 400 for inactive campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'DRAFT',
      });

      const response = await request(app)
        .post('/entries')
        .set('Authorization', 'Bearer mock-token')
        .send({
          customerId: 'user-123',
          campaignId: 'campaign-1',
          entryType: 'DEPOSIT',
          triggerTransactionId: 'TXN-123456',
        });

      expect(response.status).toBe(400);
    });

    it('should return 409 for duplicate transaction', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.customerEntry.findUnique as jest.Mock).mockResolvedValue(mockEntry);

      const response = await request(app)
        .post('/entries')
        .set('Authorization', 'Bearer mock-token')
        .send({
          customerId: 'user-123',
          campaignId: 'campaign-1',
          entryType: 'DEPOSIT',
          triggerTransactionId: 'TXN-123456',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /entries', () => {
    it('should return customer entries', async () => {
      (prisma.customerEntry.findMany as jest.Mock).mockResolvedValue([mockEntry]);
      (prisma.customerEntry.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/entries')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /entries/customer/:customerId', () => {
    it('should return customer entry history', async () => {
      (prisma.customerEntry.findMany as jest.Mock).mockResolvedValue([mockEntry]);
      (prisma.customerEntry.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app)
        .get('/entries/customer/user-123')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /entries/customer/:customerId/summary', () => {
    it('should return customer summary', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([
        { ...mockCampaign, entries: [{ entriesEarned: 10, entryDate: new Date() }], _count: { entries: 1 } },
      ]);

      const response = await request(app)
        .get('/entries/customer/user-123/summary')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
