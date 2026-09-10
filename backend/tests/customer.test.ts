import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/validate', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    customerEntry: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    drawWinner: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      count: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import customerRouter from '../src/routes/customer.routes';

const app = express();
app.use(express.json());
app.use('/customer', customerRouter);

describe('Customer Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /customer/dashboard', () => {
    it('should return customer dashboard summary', async () => {
      const prisma = require('../src/config/database').default;
      prisma.campaign.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Smart Savings',
          status: 'ACTIVE',
          drawDate: new Date(),
          entries: [{ entriesEarned: 3, entryDate: new Date() }],
        },
      ]);
      (prisma.drawWinner.count as jest.Mock).mockResolvedValue(1);
      (prisma.notification.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/customer/dashboard')
        .set('X-Customer-Id', 'CUST-000001');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalEntries).toBe(3);
      expect(response.body.data.totalWins).toBe(1);
      expect(response.body.data.unreadNotifications).toBe(2);
    });

    it('should return 401 without a customer id', async () => {
      const response = await request(app).get('/customer/dashboard');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /customer/campaigns', () => {
    it('should return the public campaign catalogue', async () => {
      const prisma = require('../src/config/database').default;
      prisma.campaign.findMany.mockResolvedValue([
        { id: 'c1', name: 'Campaign A', prizes: [] },
      ]);
      prisma.campaign.count.mockResolvedValue(1);

      const response = await request(app).get('/customer/campaigns');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /customer/entries', () => {
    it('should return the customer entry history', async () => {
      const prisma = require('../src/config/database').default;
      prisma.customerEntry.findMany.mockResolvedValue([
        {
          id: 'e1',
          customerId: 'CUST-000001',
          campaignId: 'c1',
          entriesEarned: 2,
          campaign: { id: 'c1', name: 'Campaign A' },
        },
      ]);
      prisma.customerEntry.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/customer/entries')
        .query({ customerId: 'CUST-000001' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /customer/wins', () => {
    it('should return customer wins', async () => {
      const prisma = require('../src/config/database').default;
      prisma.drawWinner.findMany.mockResolvedValue([
        {
          id: 'w1',
          prize: { name: 'Mazda EZ-6' },
          status: 'ACCEPTED',
        },
      ]);

      const response = await request(app)
        .get('/customer/wins')
        .set('X-Customer-Id', 'CUST-000001');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /customer/notifications', () => {
    it('should return the customer notification inbox', async () => {
      const prisma = require('../src/config/database').default;
      prisma.notification.findMany.mockResolvedValue([
        {
          id: 'n1',
          type: 'ENTRY_CONFIRMATION',
          message: 'You earned 2 entries!',
          status: 'SENT',
        },
      ]);
      prisma.notification.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/customer/notifications')
        .set('X-Customer-Id', 'CUST-000001');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
    });
  });

  describe('PUT /customer/notifications/:id/read', () => {
    it('should mark a notification as read', async () => {
      const prisma = require('../src/config/database').default;
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .put('/customer/notifications/3f4bd0a2-0000-0000-0000-000000000000/read')
        .set('X-Customer-Id', 'CUST-000001');

      expect(response.status).toBe(200);
      expect(prisma.notification.updateMany).toHaveBeenCalled();
    });

    it('should return 404 if the notification does not belong to the customer', async () => {
      const prisma = require('../src/config/database').default;
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .put('/customer/notifications/3f4bd0a2-0000-0000-0000-000000000000/read')
        .set('X-Customer-Id', 'CUST-999999');

      expect(response.status).toBe(404);
    });
  });
});