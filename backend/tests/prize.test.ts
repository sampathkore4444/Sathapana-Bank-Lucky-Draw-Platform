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
      findUnique: jest.fn(),
    },
    prize: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
import prizeRouter from '../src/routes/prize.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/prizes', prizeRouter);

describe('Prize API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /prizes', () => {
    it('should return list of prizes', async () => {
      const mockPrizes = [
        {
          id: 'prize-1',
          name: 'Mazda EZ-6',
          category: 'VEHICLE',
          estimatedValue: 35000,
          campaign: { id: 'campaign-1', name: 'Test Campaign' },
          _count: { winners: 1 },
        },
      ];

      (prisma.prize.findMany as jest.Mock).mockResolvedValue(mockPrizes);
      (prisma.prize.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/prizes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by campaignId', async () => {
      (prisma.prize.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.prize.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/prizes?campaignId=campaign-1');

      expect(prisma.prize.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ campaignId: 'campaign-1' }),
        })
      );
    });
  });

  describe('GET /prizes/:id', () => {
    it('should return prize by ID', async () => {
      const mockPrize = {
        id: 'prize-1',
        name: 'Mazda EZ-6',
        category: 'VEHICLE',
        estimatedValue: 35000,
        campaign: { id: 'campaign-1', name: 'Test Campaign' },
        winners: [],
      };

      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(mockPrize);

      const response = await request(app).get('/prizes/prize-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Mazda EZ-6');
    });

    it('should return 404 for non-existent prize', async () => {
      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/prizes/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /prizes', () => {
    it('should create a new prize', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Test Campaign',
      };

      const mockPrize = {
        id: 'prize-1',
        name: 'Gold Bar',
        category: 'GOLD',
        estimatedValue: 800,
        campaign: mockCampaign,
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.prize.create as jest.Mock).mockResolvedValue(mockPrize);

      const response = await request(app)
        .post('/prizes')
        .send({
          campaignId: 'campaign-1',
          rank: 1,
          name: 'Gold Bar',
          category: 'GOLD',
          quantity: 10,
          estimatedValue: 800,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Gold Bar');
    });

    it('should return error if campaign not found', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/prizes')
        .send({
          campaignId: 'nonexistent',
          rank: 1,
          name: 'Gold Bar',
          category: 'GOLD',
          quantity: 10,
          estimatedValue: 800,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /prizes/:id', () => {
    it('should update prize', async () => {
      const mockPrize = {
        id: 'prize-1',
        name: 'Gold Bar',
        campaign: { id: 'campaign-1', name: 'Test Campaign' },
      };

      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(mockPrize);
      (prisma.prize.update as jest.Mock).mockResolvedValue({
        ...mockPrize,
        name: 'Updated Gold Bar',
      });

      const response = await request(app)
        .put('/prizes/prize-1')
        .send({ name: 'Updated Gold Bar' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent prize', async () => {
      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/prizes/nonexistent')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /prizes/:id', () => {
    it('should delete prize without winners', async () => {
      const mockPrize = {
        id: 'prize-1',
        _count: { winners: 0 },
      };

      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(mockPrize);
      (prisma.prize.delete as jest.Mock).mockResolvedValue({});

      const response = await request(app).delete('/prizes/prize-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not delete prize with winners', async () => {
      const mockPrize = {
        id: 'prize-1',
        _count: { winners: 3 },
      };

      (prisma.prize.findUnique as jest.Mock).mockResolvedValue(mockPrize);

      const response = await request(app).delete('/prizes/prize-1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /prizes/campaign/:campaignId', () => {
    it('should return prizes for a campaign', async () => {
      const mockPrizes = [
        {
          id: 'prize-1',
          name: 'Gold Bar',
          _count: { winners: 2 },
        },
      ];

      (prisma.prize.findMany as jest.Mock).mockResolvedValue(mockPrizes);

      const response = await request(app).get('/prizes/campaign/campaign-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
