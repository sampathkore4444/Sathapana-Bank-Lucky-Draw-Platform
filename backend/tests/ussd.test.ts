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
    },
    drawWinner: {
      findMany: jest.fn(),
    },
  },
}));

import ussdRouter from '../src/routes/ussd.routes';

const app = express();
app.use(express.json());
app.use('/ussd', ussdRouter);

describe('USSD Interface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const post = (text: string, customerId?: string) =>
    request(app)
      .post('/ussd')
      .send({ sessionId: 'session-1', phoneNumber: '+85512345678', text, customerId });

  it('should show the main menu on first request', async () => {
    const response = await post('');
    expect(response.status).toBe(200);
    expect(response.text).toContain('CON Welcome to Sathapana Lucky Draw!');
  });

  it('should show entries summary for a linked customer', async () => {
    const prisma = require('../src/config/database').default;
    prisma.campaign.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Smart Savings',
        status: 'ACTIVE',
        drawDate: new Date('2025-12-15'),
        entries: [{ entriesEarned: 5 }],
      },
    ]);

    const response = await post('1', 'CUST-000001');
    expect(response.status).toBe(200);
    expect(response.text).toContain('CON Your Entries:');
    expect(response.text).toContain('5 entries');
  });

  it('should request linking when no customerId is provided', async () => {
    const response = await post('1');
    expect(response.status).toBe(200);
    expect(response.text).toContain('END No linked account found');
  });

  it('should show wins', async () => {
    const prisma = require('../src/config/database').default;
    prisma.drawWinner.findMany.mockResolvedValue([
      { id: 'w1', customerId: 'CUST-000001', isAlternate: false, status: 'ACCEPTED', prize: { name: 'Gold Bar' } },
    ]);

    const response = await post('2', 'CUST-000001');
    expect(response.text).toContain('CON Your Wins:');
    expect(response.text).toContain('Gold Bar');
  });

  it('should show upcoming draws', async () => {
    const prisma = require('../src/config/database').default;
    prisma.campaign.findMany.mockResolvedValue([
      { id: 'c1', name: 'Mobile Draw', status: 'ACTIVE', drawDate: new Date('2025-12-20') },
    ]);

    const response = await post('3');
    expect(response.text).toContain('CON Upcoming Draws:');
    expect(response.text).toContain('Mobile Draw');
  });

  it('should handle an invalid option', async () => {
    const response = await post('9');
    expect(response.text).toContain('END Invalid option');
  });
});