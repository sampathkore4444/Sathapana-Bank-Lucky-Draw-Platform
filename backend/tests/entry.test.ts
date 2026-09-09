import request from 'supertest';
import express from 'express';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    customerEntry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
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

// Mock validation middleware
jest.mock('../src/middleware/validate', () => ({
  validate: () => (req: any, res: any, next: any) => next(),
}));

import prisma from '../src/config/database';
import entryRouter from '../src/routes/entry.routes';

const VALID_CAMPAIGN_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_CUSTOMER_ID = '550e8400-e29b-41d4-a716-446655440001';

const app = express();
app.use(express.json());
app.use('/entries', entryRouter);

describe('Entry API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /entries', () => {
    it('should register a new entry successfully', async () => {
      const mockCampaign = {
        id: VALID_CAMPAIGN_ID,
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2027-12-31'),
        entryRules: [{ trigger: 'ACCOUNT_OPENED', entriesPerAction: 5 }],
      };

      const mockEntry = {
        id: 'entry-1',
        customerId: VALID_CUSTOMER_ID,
        campaignId: VALID_CAMPAIGN_ID,
        entryType: 'ACCOUNT_OPENED',
        entriesEarned: 5,
        cumulativeEntries: 5,
        verified: true,
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.customerEntry.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.customerEntry.aggregate as jest.Mock).mockResolvedValue({ _sum: { entriesEarned: 0 } });
      (prisma.customerEntry.create as jest.Mock).mockResolvedValue(mockEntry);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/entries')
        .send({
          customerId: VALID_CUSTOMER_ID,
          campaignId: VALID_CAMPAIGN_ID,
          entryType: 'ACCOUNT_OPENED',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.entriesEarned).toBe(5);
    });

    it('should return error if campaign not found', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/entries')
        .send({
          customerId: VALID_CUSTOMER_ID,
          campaignId: VALID_CAMPAIGN_ID,
          entryType: 'DEPOSIT',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return error if campaign is not active', async () => {
      const mockCampaign = {
        id: VALID_CAMPAIGN_ID,
        status: 'DRAFT',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2027-12-31'),
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app)
        .post('/entries')
        .send({
          customerId: VALID_CUSTOMER_ID,
          campaignId: VALID_CAMPAIGN_ID,
          entryType: 'DEPOSIT',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return error for duplicate entry', async () => {
      const mockCampaign = {
        id: VALID_CAMPAIGN_ID,
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2027-12-31'),
        entryRules: [],
      };

      const existingEntry = {
        id: 'existing-entry',
        customerId: VALID_CUSTOMER_ID,
        campaignId: VALID_CAMPAIGN_ID,
        triggerTransactionId: 'txn-123',
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.customerEntry.findUnique as jest.Mock).mockResolvedValue(existingEntry);

      const response = await request(app)
        .post('/entries')
        .send({
          customerId: VALID_CUSTOMER_ID,
          campaignId: VALID_CAMPAIGN_ID,
          entryType: 'DEPOSIT',
          triggerTransactionId: 'txn-123',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /entries', () => {
    it('should return list of entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          customerId: VALID_CUSTOMER_ID,
          campaignId: VALID_CAMPAIGN_ID,
          entriesEarned: 5,
        },
      ];

      (prisma.customerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.customerEntry.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/entries');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /entries/customer/:customerId', () => {
    it('should return customer entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          customerId: VALID_CUSTOMER_ID,
          entriesEarned: 5,
          campaign: { id: VALID_CAMPAIGN_ID, name: 'Test Campaign' },
        },
      ];

      (prisma.customerEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.customerEntry.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get(`/entries/customer/${VALID_CUSTOMER_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /entries/eligibility/:customerId/:campaignId', () => {
    it('should check customer eligibility', async () => {
      const mockCampaign = {
        id: VALID_CAMPAIGN_ID,
        status: 'ACTIVE',
        eligibilityCriteria: { maxEntriesPerCustomer: 50 },
        entries: [{ entriesEarned: 5, entryDate: new Date() }],
      };

      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const response = await request(app).get(`/entries/eligibility/${VALID_CUSTOMER_ID}/${VALID_CAMPAIGN_ID}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(true);
    });
  });
});
