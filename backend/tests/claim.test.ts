import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/validate', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    drawWinner: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    prizeClaim: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prize: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1', email: 'coord@test.com', role: 'PRIZE_COORDINATOR' };
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));

import prisma from '../src/config/database';
import claimRouter from '../src/routes/claim.routes';

const app = express();
app.use(express.json());
app.use('/claims', claimRouter);

const WINNER_ID = '3f4bd0a2-0000-0000-0000-000000000001';
const CLAIM_ID = '3f4bd0a2-0000-0000-0000-000000000002';

describe('Prize Claims & Documents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /claims', () => {
    it('should create a claim for a winner', async () => {
      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue({
        id: WINNER_ID,
        customerId: 'CUST-000001',
        isAlternate: false,
        status: 'ACCEPTED',
        prizeId: 'prize-1',
        claim: null,
      });
      (prisma.prizeClaim.create as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'SUBMITTED',
        meaning: 'not-validated',
      });

      const response = await request(app)
        .post('/claims')
        .send({ winnerId: WINNER_ID });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.meaning).toBe('not-validated');
    });

    it('should reject a claim belonging to another customer', async () => {
      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue({
        id: WINNER_ID,
        customerId: 'CUST-999999',
        isAlternate: false,
        status: 'ACCEPTED',
        claim: null,
      });

      const response = await request(app)
        .post('/claims')
        .set('X-Customer-Id', 'CUST-000001')
        .send({ winnerId: WINNER_ID });

      expect(response.status).toBe(403);
    });

    it('should reject a duplicate claim', async () => {
      (prisma.drawWinner.findUnique as jest.Mock).mockResolvedValue({
        id: WINNER_ID,
        customerId: 'CUST-000001',
        isAlternate: false,
        status: 'ACCEPTED',
        claim: { id: 'existing-claim' },
      });

      const response = await request(app)
        .post('/claims')
        .send({ winnerId: WINNER_ID });

      expect(response.status).toBe(409);
    });
  });

  describe('GET /claims', () => {
    it('should list claims', async () => {
      (prisma.prizeClaim.findMany as jest.Mock).mockResolvedValue([
        { id: CLAIM_ID, status: 'SUBMITTED', documents: [] },
      ]);
      (prisma.prizeClaim.count as jest.Mock).mockResolvedValue(1);

      const response = await request(app).get('/claims');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /claims/:id/documents', () => {
    it('should attach a document to a claim', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        winnerId: WINNER_ID,
      });
      (prisma.document.create as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        type: 'ID_PROOF',
        status: 'PENDING',
      });

      const response = await request(app)
        .post(`/claims/${CLAIM_ID}/documents`)
        .send({ type: 'ID_PROOF', filePath: '/uploads/id.pdf', mimeType: 'application/pdf', size: 1234 });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject a document with an unsupported MIME type', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        winnerId: WINNER_ID,
      });

      const response = await request(app)
        .post(`/claims/${CLAIM_ID}/documents`)
        .send({ type: 'ID_PROOF', filePath: '/uploads/evil.html', mimeType: 'text/html', size: 100 });

      expect(response.status).toBe(400);
    });

    it('should reject a document with a path traversal file path', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        winnerId: WINNER_ID,
      });

      const response = await request(app)
        .post(`/claims/${CLAIM_ID}/documents`)
        .send({ type: 'ID_PROOF', filePath: '..%2F..%2Fetc%2Fpasswd', mimeType: 'application/pdf', size: 100 });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /claims/:id/review', () => {
    it('should approve a claim and accept the winner', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'SUBMITTED',
        winnerId: WINNER_ID,
      });
      (prisma.prizeClaim.update as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'APPROVED',
      });
      (prisma.drawWinner.update as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .put(`/claims/${CLAIM_ID}/review`)
        .send({ status: 'APPROVED', decisionNote: 'ok' });

      expect(response.status).toBe(200);
      expect(prisma.drawWinner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) })
      );
    });
  });

  describe('PUT /claims/:id/fulfill', () => {
    it('should fulfill an approved claim', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'APPROVED',
        winnerId: WINNER_ID,
        winner: { prizeId: 'prize-1' },
      });
      (prisma.prizeClaim.update as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'FULFILLED',
      });
      (prisma.drawWinner.update as jest.Mock).mockResolvedValue({
        status: 'FULFILLED',
      });
      (prisma.prize.update as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const response = await request(app).put(`/claims/${CLAIM_ID}/fulfill`);

      expect(response.status).toBe(200);
      expect(prisma.prize.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fulfilled: { increment: 1 } }) })
      );
    });

    it('should reject fulfillment of a claim that is not approved', async () => {
      (prisma.prizeClaim.findUnique as jest.Mock).mockResolvedValue({
        id: CLAIM_ID,
        status: 'REJECTED',
        winnerId: WINNER_ID,
      });

      const response = await request(app).put(`/claims/${CLAIM_ID}/fulfill`);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /claims/documents/:id/verify', () => {
    it('should mark a document as verified', async () => {
      (prisma.document.findUnique as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        status: 'PENDING',
      });
      (prisma.document.update as jest.Mock).mockResolvedValue({
        id: 'doc-1',
        status: 'VERIFIED',
      });

      const response = await request(app)
        .put('/claims/documents/doc-1/verify')
        .send({ status: 'VERIFIED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});