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
    drawWinner: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    drawResult: {
      findUnique: jest.fn(),
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
import winnerRouter from '../src/routes/winner.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/winners', winnerRouter);

describe('Winner API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /winners', () => {
    it('should return list of winners', async () => {
      const mockWinners = [
        {
          id: 'winner-1',
          customerId: 'cust-1',
          status: 'SELECTED',
          prize: { name: 'Mazda EZ-6' },
          drawResult: {
            campaign: { id: 'campaign-1', name: 'Test Campaign' },
          },
        },
      ];

      (prisma.drawWinner.findMany as jest.Mock).mockResolvedValue(mockWinners);
      (prisma.drawWinner.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/winners');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      (prisma.drawWinner.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.drawWinner.count as jest.Mock).mockResolvedValue(0);

      await request(app).get('/winners?status=SELECTED');

      expect(prisma.drawWinner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SELECTED' }),
        })
      );
    });
  });

  describe('GET /winners/:id', () => {
    it('should return winner by ID', async () => {
      const mockWinner = {
        id: 'winner-1',
        customerId: 'cust-1',
        status: 'SELECTED',
        prize: { name: 'Mazda EZ-6' },
        drawResult: {
          campaign: { id: 'campaign-1', name: 'Test Campaign', drawDate: new Date() },
        },
      };

      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(mockWinner);

      const response = await request(app).get('/winners/winner-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('winner-1');
    });

    it('should return 404 for non-existent winner', async () => {
      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/winners/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /winners/:id/status', () => {
    it('should update winner status', async () => {
      const mockWinner = {
        id: 'winner-1',
        status: 'SELECTED',
      };

      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(mockWinner);
      (prisma.drawWinner.update as jest.Mock).mockResolvedValue({
        ...mockWinner,
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .put('/winners/winner-1/status')
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not allow invalid status transition', async () => {
      const mockWinner = {
        id: 'winner-1',
        status: 'FULFILLED',
      };

      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(mockWinner);

      const response = await request(app)
        .put('/winners/winner-1/status')
        .send({ status: 'SELECTED' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent winner', async () => {
      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/winners/nonexistent/status')
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /winners/campaign/:campaignId', () => {
    it('should return winners for a campaign', async () => {
      const mockWinners = [
        {
          id: 'winner-1',
          customerId: 'cust-1',
          prize: { name: 'Mazda EZ-6' },
          drawResult: { drawDate: new Date() },
        },
      ];

      (prisma.drawWinner.findMany as jest.Mock).mockResolvedValue(mockWinners);

      const response = await request(app).get('/winners/campaign/campaign-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /winners/customer/:customerId', () => {
    it('should return wins for a customer', async () => {
      const mockWins = [
        {
          id: 'winner-1',
          customerId: 'cust-1',
          prize: { name: 'Mazda EZ-6' },
          drawResult: {
            campaign: { id: 'campaign-1', name: 'Test Campaign', drawDate: new Date() },
          },
        },
      ];

      (prisma.drawWinner.findMany as jest.Mock).mockResolvedValue(mockWins);

      const response = await request(app).get('/winners/customer/cust-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /winners/:id/promote-alternate', () => {
    it('should promote alternate to winner', async () => {
      const mockAlternate = {
        id: 'alternate-1',
        isAlternate: true,
        drawResultId: 'draw-1',
        prizeId: 'prize-1',
      };

      const mockDeclinedWinner = {
        id: 'winner-1',
        rank: 1,
        status: 'DECLINED',
      };

      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(mockAlternate);
      (prisma.drawWinner.findFirst as jest.Mock).mockResolvedValue(mockDeclinedWinner);
      (prisma.drawWinner.update as jest.Mock).mockResolvedValue({
        ...mockAlternate,
        isAlternate: false,
        rank: 1,
        status: 'SELECTED',
      });

      const response = await request(app).post('/winners/alternate-1/promote-alternate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not promote non-alternate', async () => {
      const mockWinner = {
        id: 'winner-1',
        isAlternate: false,
      };

      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue(mockWinner);

      const response = await request(app).post('/winners/winner-1/promote-alternate');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
