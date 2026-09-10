import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/validate', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    campaignApproval: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    prize: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
    customerEntry: {
      groupBy: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

let mockCurrentRole = 'MARKETING_MANAGER';

jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      userId: mockCurrentRole === 'COMPLIANCE_OFFICER' ? 'user-3' : 'user-2',
      email: mockCurrentRole === 'COMPLIANCE_OFFICER' ? 'compliance@test.com' : 'marketing@test.com',
      role: mockCurrentRole,
    };
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));

import prisma from '../src/config/database';
import campaignRouter from '../src/routes/campaign.routes';

const app = express();
app.use(express.json());
app.use('/campaigns', campaignRouter);

describe('Campaign Approval & Duplicate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentRole = 'MARKETING_MANAGER';
  });

  describe('POST /campaigns/:id/submit', () => {
    it('should submit a draft for approval', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'DRAFT',
      });
      (prisma.prize.count as jest.Mock).mockResolvedValue(2);
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'PENDING_APPROVAL',
      });
      (prisma.campaignApproval.upsert as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/campaigns/campaign-1/submit');

      expect(response.status).toBe(200);
      expect(prisma.campaignApproval.upsert).toHaveBeenCalledTimes(2);
    });

    it('should reject submission without prizes', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'DRAFT',
      });
      (prisma.prize.count as jest.Mock).mockResolvedValue(0);

      const response = await request(app).post('/campaigns/campaign-1/submit');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /campaigns/:id/approval/:level/approve', () => {
    it('should approve level 2 and move campaign to SCHEDULED when all levels approved', async () => {
      mockCurrentRole = 'COMPLIANCE_OFFICER';
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'PENDING_APPROVAL',
        approvals: [
          { id: 'a1', level: 1, status: 'APPROVED', approverId: 'user-1' },
          { id: 'a2', level: 2, status: 'PENDING' },
        ],
      });
      (prisma.campaignApproval.update as jest.Mock).mockResolvedValue({
        id: 'a2',
        status: 'APPROVED',
      });
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'SCHEDULED',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/campaigns/campaign-1/approval/2/approve');

      expect(response.status).toBe(200);
      expect(prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SCHEDULED' }) })
      );
    });

    it('should reject approval when a lower level is pending', async () => {
      mockCurrentRole = 'COMPLIANCE_OFFICER';
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'PENDING_APPROVAL',
        approvals: [
          { id: 'a1', level: 1, status: 'PENDING' },
          { id: 'a2', level: 2, status: 'PENDING' },
        ],
      });

      const response = await request(app).post('/campaigns/campaign-1/approval/2/approve');

      expect(response.status).toBe(400);
    });

    it('should return 403 for unauthorised role at a level', async () => {
      // Role is mocked as MARKETING_MANAGER (level-1 only)
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'PENDING_APPROVAL',
        approvals: [
          { id: 'a1', level: 1, status: 'APPROVED', approverId: 'user-1' },
          { id: 'a2', level: 2, status: 'PENDING' },
        ],
      });

      const response = await request(app).post('/campaigns/campaign-1/approval/2/approve');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /campaigns/:id/approval/:level/reject', () => {
    it('should reject the campaign back to DRAFT', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'PENDING_APPROVAL',
        approvals: [{ id: 'a1', level: 1, status: 'APPROVED' }],
      });
      (prisma.campaignApproval.update as jest.Mock).mockResolvedValue({});
      (prisma.campaign.update as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        status: 'DRAFT',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/campaigns/campaign-1/approval/1/reject');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /campaigns/:id/duplicate', () => {
    it('should duplicate a campaign with its prizes', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'campaign-1',
        name: 'Original Campaign',
        description: 'desc',
        type: 'DEPOSIT_BASED',
        status: 'DRAWN',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-01'),
        drawDate: new Date('2025-07-01'),
        eligibilityCriteria: {},
        entryRules: [],
        drawSettings: {},
        termsAndConditions: null,
        notificationSettings: {},
        metadata: {},
        prizes: [
          {
            id: 'prize-1',
            campaignId: 'campaign-1',
            rank: 1,
            name: 'Car',
            category: 'VEHICLE',
            description: null,
            quantity: 1,
            estimatedValue: 30000,
            currency: 'USD',
            vendorName: null,
            vendorContact: null,
            fulfillmentInstructions: null,
            alternativesOffered: [],
            termsAndConditions: null,
          },
        ],
      });
      (prisma.campaign.create as jest.Mock).mockResolvedValue({
        id: 'campaign-2',
        name: 'Original Campaign (Copy)',
        status: 'DRAFT',
        _count: { entries: 0, prizes: 1 },
      });
      (prisma.prize.createMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).post('/campaigns/campaign-1/duplicate');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(prisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Original Campaign (Copy)', status: 'DRAFT' }),
        })
      );
      expect(prisma.prize.createMany).toHaveBeenCalled();
    });
  });

  describe('GET /campaigns/approvals/list', () => {
    it('should list campaigns in the approval queue', async () => {
      (prisma.campaign.findMany as jest.Mock).mockResolvedValue([
        { id: 'campaign-1', status: 'PENDING_APPROVAL', approvals: [] },
      ]);
      (prisma.campaign.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/campaigns/approvals/list');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });
});