import request from 'supertest';
import express from 'express';

jest.mock('../src/middleware/validate', () => ({
  validate: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../src/config/redis', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../src/middleware/auth', () => ({
  __esModule: true,
  generateToken: jest.fn(() => 'mock-access-token'),
  authenticate: (req: any, res: any, next: any) => {
    req.user = { userId: 'user-1', email: 'test@test.com', role: 'SUPER_ADMIN' };
    next();
  },
  authorize: () => (_req: any, _res: any, next: any) => next(),
}));

import prisma from '../src/config/database';
import authRouter from '../src/routes/auth.routes';
import { hashRefreshToken } from '../src/services/auth.service';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('Refresh Token Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/refresh', () => {
    it('should rotate a valid refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        token: 'old-refresh-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        revokedAt: null,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);
      (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        token: 'new-refresh-token',
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'old-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('mock-access-token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) })
      );
    });

    it('should return 401 for an invalid refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'unknown-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for a revoked refresh token', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        token: 'revoked',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        revokedAt: new Date(),
        user: { id: 'user-1', isActive: true },
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'revoked' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke the refresh token', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer token')
        .send({ refreshToken: 'token-to-revoke' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: hashRefreshToken('token-to-revoke'), userId: 'user-1' },
        })
      );
    });
  });
});