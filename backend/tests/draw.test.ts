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
      update: jest.fn(),
    },
    drawResult: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    drawWinner: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    prize: {
      findMany: jest.fn(),
    },
    customerEntry: {
      groupBy: jest.fn(),
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

// Mock DrawEngine
jest.mock('../src/services/drawEngine', () => ({
  DrawEngine: jest.fn().mockImplementation(() => ({
    executeDraw: jest.fn().mockResolvedValue({
      drawId: 'draw-1',
      seed: 'a'.repeat(64),
      auditHash: 'b'.repeat(64),
      winners: [
        { rank: 1, customerId: 'cust-1', entriesAtDraw: 10, selectedAt: new Date().toISOString() },
      ],
      alternates: [
        { rank: 2, customerId: 'cust-2', entriesAtDraw: 5, selectedAt: new Date().toISOString() },
      ],
    }),
    verifyDraw: jest.fn().mockResolvedValue(true),
  })),
}));

import prisma from '../src/config/database';
import drawRouter from '../src/routes/draw.routes';

// Create test app
const app = express();
app.use(express.json());
app.use('/draws', drawRouter);

describe('Draw API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /draws', () => {
    it('should execute a draw successfully', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        status: 'ACTIVE',
      };

      const mockDrawResult = {
        id: 'draw-1',
        campaignId: 'campaign-1',
        executedBy: [],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.drawResult.update as jest.Mock).mockResolvedValue(mockDrawResult);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});
      (prisma.drawWinner.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/draws')
        .send({
          campaignId: 'campaign-1',
          numberOfWinners: 1,
          numberOfAlternates: 3,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.winners).toHaveLength(1);
    });

    it('should return error if campaign not found', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/draws')
        .send({
          campaignId: 'nonexistent',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /draws', () => {
    it('should return list of draws', async () => {
      const mockDraws = [
        {
          id: 'draw-1',
          campaignId: 'campaign-1',
          campaign: { id: 'campaign-1', name: 'Test Campaign' },
          winners: [],
          _count: { winners: 1 },
        },
      ];

      (prisma.drawResult.findMany as jest.Mock).mockResolvedValue(mockDraws);
      (prisma.drawResult.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/draws');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /draws/:id', () => {
    it('should return draw by ID', async () => {
      const mockDraw = {
        id: 'draw-1',
        campaignId: 'campaign-1',
        campaign: { id: 'campaign-1', name: 'Test Campaign', drawDate: new Date() },
        winners: [],
      };

      (prisma.drawResult.findUnique as jest.Mock).mockResolvedValue(mockDraw);

      const response = await request(app).get('/draws/draw-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('draw-1');
    });

    it('should return 404 for non-existent draw', async () => {
      (prisma.drawResult.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app).get('/draws/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /draws/:id/witness', () => {
    it('should add witness to draw', async () => {
      const mockDraw = {
        id: 'draw-1',
        witnessedBy: [],
      };

      (prisma.drawResult.findUnique as jest.Mock).mockResolvedValue(mockDraw);
      (prisma.drawResult.update as jest.Mock).mockResolvedValue({
        ...mockDraw,
        witnessedBy: ['user-1'],
      });

      const response = await request(app).post('/draws/draw-1/witness');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not add duplicate witness', async () => {
      const mockDraw = {
        id: 'draw-1',
        witnessedBy: ['user-1'],
      };

      (prisma.drawResult.findUnique as jest.Mock).mockResolvedValue(mockDraw);

      const response = await request(app).post('/draws/draw-1/witness');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /draws/:id/verify', () => {
    it('should verify draw results', async () => {
      const mockDraw = {
        id: 'draw-1',
        isVerified: false,
      };

      (prisma.drawResult.findUnique as jest.Mock).mockResolvedValue(mockDraw);
      (prisma.drawResult.update as jest.Mock).mockResolvedValue({
        ...mockDraw,
        isVerified: true,
        verifiedAt: new Date(),
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/draws/draw-1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /draws/campaign/:campaignId', () => {
    it('should return draws for a campaign', async () => {
      const mockDraws = [
        {
          id: 'draw-1',
          campaignId: 'campaign-1',
          winners: [],
          _count: { winners: 1 },
        },
      ];

      (prisma.drawResult.findMany as jest.Mock).mockResolvedValue(mockDraws);

      const response = await request(app).get('/draws/campaign/campaign-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
