import request from 'supertest';
// Mock validation middleware
jest.mock("../src/middleware/validate", () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));
import express from 'express';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
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
import campaignRouter from '../src/routes/campaign.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/campaigns', campaignRouter);

describe('Campaign API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /campaigns', () => {
    it('should return list of campaigns', async () => {
      const mockCampaigns = [
        {
          id: 'campaign-1',
          name: 'Test Campaign',
          status: 'ACTIVE',
          _count: { entries: 100, prizes: 5 },
        },
      ];

      (prisma.campaign.findMany as jest.Mock).mockResolvedValue(mockCampaigns);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/campaigns');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by status', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/campaigns?status=ACTIVE');

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });
  });

  describe('GET /campaigns/:id', () => {
    it('should return campaign by ID', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        status: 'ACTIVE',
        prizes: [],
        _count: { entries: 100, drawResults: 5 },
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).get('/campaigns/campaign-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Campaign');
    });

    it('should return 404 for non-existent campaign', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/campaigns/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /campaigns', () => {
    it('should create a new campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'New Campaign',
        status: 'DRAFT',
        _count: { entries: 0, prizes: 0 },
      };

      (prisma.campaign.create as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/campaigns')
        .send({
          name: 'New Campaign',
          type: 'DEPOSIT_BASED',
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          drawDate: '2025-12-15',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New Campaign');
    });
  });

  describe('POST /campaigns/:id/activate', () => {
    it('should activate a campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'SCHEDULED',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'ACTIVE',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/campaigns/campaign-1/activate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not activate an active campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'ACTIVE',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).post('/campaigns/campaign-1/activate');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /campaigns/:id/pause', () => {
    it('should pause an active campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'ACTIVE',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'SCHEDULED',
      });

      const response = await request(app).post('/campaigns/campaign-1/pause');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not pause a non-active campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'DRAFT',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).post('/campaigns/campaign-1/pause');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /campaigns/:id', () => {
    it('should delete a draft campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'DRAFT',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.campaign.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/campaigns/campaign-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not delete a non-draft campaign', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'ACTIVE',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).delete('/campaigns/campaign-1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /campaigns/:id/stats', () => {
    it('should return campaign statistics', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
        status: 'ACTIVE',
        _count: { entries: 10, prizes: 3, drawResults: 1 },
        entries: [
          { entriesEarned: 5, verified: true, entryType: 'DEPOSIT', customerId: 'cust-1' },
          { entriesEarned: 3, verified: true, entryType: 'DEPOSIT', customerId: 'cust-2' },
          { entriesEarned: 2, verified: false, entryType: 'ACCOUNT_OPENED', customerId: 'cust-1' },
        ],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).get('/campaigns/campaign-1/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEntries).toBe(10);
      expect(response.body.data.uniqueParticipants).toBe(2);
    });
  });
});
