import request from 'supertest';
import express from 'express';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    customerEntry: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    drawWinner: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    prize: {
      aggregate: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// Mock auth middleware
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-1', email: 'test@test.com', role: 'SUPER_ADMIN' };
    next();
  },
  authorize: () => (req: any, res: any, next: any) => next(),
}));

import prisma from '../src/config/database';
import adminRouter from '../src/routes/admin.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/admin', adminRouter);

describe('Admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/dashboard', () => {
    it('should return dashboard statistics', async () => {
      (prisma.campaign.count as jest.Mock)
        .mockResolvedValueOnce(10) // total campaigns
        .mockResolvedValueOnce(3); // active campaigns
      
      (prisma.customerEntry.count as jest.Mock).mockResolvedValue(1000);
      (prisma.drawWinner.count as jest.Mock).mockResolvedValue(15);
      (prisma.prize.aggregate as jest.Mock).mockResolvedValue({
        _sum: { estimatedValue: 50000 },
      });
      (prisma.customerEntry.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.customerEntry.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.campaign.groupBy as jest.Mock).mockResolvedValue([]);

      const response = await request(app).get('/admin/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview.totalCampaigns).toBe(10);
      expect(response.body.data.overview.activeCampaigns).toBe(3);
      expect(response.body.data.overview.totalEntries).toBe(1000);
      expect(response.body.data.overview.totalWinners).toBe(15);
      expect(response.body.data.overview.totalPrizeValue).toBe(50000);
    });
  });

  describe('GET /admin/reports/campaign-performance', () => {
    it('should return campaign performance report', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(),
          _count: { entries: 100, prizes: 5, drawResults: 1 },
          entries: [
            { entriesEarned: 5, customerId: 'cust-1' },
            { entriesEarned: 3, customerId: 'cust-2' },
          ],
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);

      const response = await request(app).get('/admin/reports/campaign-performance');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].totalEntries).toBe(8);
      expect(response.body.data[0].uniqueParticipants).toBe(2);
    });
  });

  describe('GET /admin/reports/winner-fulfillment', () => {
    it('should return winner fulfillment report', async () => {
      const mockWinners = [
        { status: 'SELECTED', _count: { id: 5 } },
        { status: 'FULFILLED', _count: { id: 10 } },
      ];

      (prisma.drawWinner.groupBy as jest.Mock).mockResolvedValue(mockWinners);

      const response = await request(app).get('/admin/reports/winner-fulfillment');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalWinners).toBe(15);
      expect(response.body.data.summary.byStatus).toHaveLength(2);
    });
  });

  describe('GET /admin/audit-logs', () => {
    it('should return audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          entityType: 'CAMPAIGN',
          action: 'CREATED',
          user: { id: 'user-1', email: 'test@test.com' },
        },
      ];

      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/admin/audit-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by entityType', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/admin/audit-logs?entityType=CAMPAIGN');

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'CAMPAIGN' }),
        })
      );
    });
  });

  describe('GET /admin/users', () => {
    it('should return list of users', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'admin@test.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/admin/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by role', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/admin/users?role=SUPER_ADMIN');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'SUPER_ADMIN' }),
        })
      );
    });
  });

  describe('PUT /admin/users/:id/role', () => {
    it('should update user role', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.com',
        role: 'READ_ONLY',
      };

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        role: 'CAMPAIGN_MANAGER',
      });

      const response = await request(app)
        .put('/admin/users/user-1/role')
        .send({ role: 'CAMPAIGN_MANAGER' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /admin/users/:id/status', () => {
    it('should deactivate user', async () => {
      const mockUser = {
        id: 'user-1',
        isActive: true,
      };

      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const response = await request(app)
        .put('/admin/users/user-1/status')
        .send({ isActive: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
