import request from 'supertest';
import express from 'express';

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findMany: jest.fn(),
    },
    customerEntry: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/services/messageQueue', () => ({
  __esModule: true,
  messageQueue: {
    publish: jest.fn().mockResolvedValue('msg-id'),
  },
}));

import prisma from '../src/config/database';
import webhookRouter from '../src/routes/webhook.routes';
import { hmacSignature } from '../src/utils/security';

const campaignFindMany = prisma.campaign.findMany as jest.Mock;
const customerEntryFindUnique = prisma.customerEntry.findUnique as jest.Mock;
const customerEntryAggregate = prisma.customerEntry.aggregate as jest.Mock;
const customerEntryCreate = prisma.customerEntry.create as jest.Mock;

const app = express();
app.use(express.json({ verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf; } }));
app.use('/webhooks', webhookRouter);

const SECRET = 'change-me';

const signed = (payload: Record<string, unknown>) => ({
  'X-Webhook-Signature': `sha256=${hmacSignature(JSON.stringify(payload), SECRET)}`,
});

describe('Core Banking Webhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webhooks/core-banking/transactions', () => {
    it('should credit entries for a qualifying transaction (HMAC signature)', async () => {
      campaignFindMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Smart Savings',
          entryRules: [
            { trigger: 'DEPOSIT', amountIncrement: 150, entriesPerIncrement: 1 },
          ],
          notificationSettings: { welcomeMessage: true, entryConfirmation: true },
          eligibilityCriteria: { maxEntriesPerCustomer: 50, minTransactionAmount: 0 },
        },
      ]);
      customerEntryFindUnique.mockResolvedValue(null);
      customerEntryAggregate.mockResolvedValue({ _sum: { entriesEarned: 0 } });
      customerEntryCreate.mockResolvedValue({
        id: 'entry-1',
        cumulativeEntries: 1,
      });

      const payload = {
        customerId: 'CUST-000001',
        accountId: 'ACC-001',
        transactionId: 'TXN-123',
        transactionType: 'DEPOSIT',
        amount: 300,
        currency: 'USD',
      };
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .set(signed(payload))
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toHaveLength(1);
      // 300 USD at 150/increment and 1 entry per increment = 2 entries
      expect(response.body.data.processed[0].entriesEarned).toBe(2);
      expect(customerEntryCreate).toHaveBeenCalled();
    });

    it('should accept the legacy X-Webhook-Secret header', async () => {
      campaignFindMany.mockResolvedValue([]);
      customerEntryFindUnique.mockResolvedValue(null);

      const payload = {
        customerId: 'CUST-000001',
        accountId: 'ACC-001',
        transactionId: 'TXN-123',
        transactionType: 'DEPOSIT',
        amount: 10,
      };
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .set('X-Webhook-Secret', SECRET)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should deduplicate the same transaction', async () => {
      campaignFindMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Smart Savings',
          entriesPerTransaction: 1,
          entryRules: [{ trigger: 'DEPOSIT', entriesPerAction: 1 }],
          notificationSettings: {},
          eligibilityCriteria: {},
        },
      ]);
      customerEntryFindUnique.mockResolvedValue({
        id: 'existing-entry',
        cumulativeEntries: 5,
      });

      const payload = {
        customerId: 'CUST-000001',
        accountId: 'ACC-001',
        transactionId: 'TXN-123',
        transactionType: 'DEPOSIT',
        amount: 300,
        currency: 'USD',
      };
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .set(signed(payload))
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.processed[0].created).toBe(false);
      expect(response.body.data.processed[0].reason).toBe('DUPLICATE_TRANSACTION');
      expect(customerEntryCreate).not.toHaveBeenCalled();
    });

    it('should reject requests with an invalid signature', async () => {
      const payload = {
        customerId: 'CUST-000001',
        transactionId: 'TXN-1',
        transactionType: 'DEPOSIT',
        amount: 10,
      };
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .set('X-Webhook-Signature', 'sha256=0000000000000000000000000000000000000000000000000000000000000000')
        .send(payload);

      expect(response.status).toBe(401);
    });

    it('should reject requests without any credentials', async () => {
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .send({
          customerId: 'CUST-000001',
          transactionId: 'TXN-1',
          transactionType: 'DEPOSIT',
          amount: 10,
        });

      expect(response.status).toBe(401);
    });

    it('should reject invalid payloads', async () => {
      const payload = { customerId: 'CUST-000001' };
      const response = await request(app)
        .post('/webhooks/core-banking/transactions')
        .set(signed(payload))
        .send(payload);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /webhooks/core-banking/account-opened', () => {
    it('should credit account-opening entries', async () => {
      campaignFindMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Account Campaign',
          entryRules: [{ trigger: 'ACCOUNT_OPENED', entriesPerAction: 5 }],
          notificationSettings: {},
          eligibilityCriteria: {},
        },
      ]);
      customerEntryFindUnique.mockResolvedValue(null);
      customerEntryAggregate.mockResolvedValue({ _sum: { entriesEarned: 0 } });
      customerEntryCreate.mockResolvedValue({
        id: 'entry-2',
        cumulativeEntries: 5,
      });

      const payload = {
        customerId: 'CUST-000002',
        accountId: 'ACC-002',
        amount: 150,
      };
      const response = await request(app)
        .post('/webhooks/core-banking/account-opened')
        .set(signed(payload))
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.data.processed[0].entriesEarned).toBe(5);
    });
  });
});