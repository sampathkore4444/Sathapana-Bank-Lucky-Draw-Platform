import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
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

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ userId: 'user-1', email: 'test@test.com', role: 'SUPER_ADMIN' })),
  TokenExpiredError: class TokenExpiredError extends Error {},
}));

import prisma from '../src/config/database';
import authRouter from '../src/routes/auth.routes';
import { generateToken } from '../src/middleware/auth';

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'new@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'READ_ONLY',
        createdAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'new@test.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('new@test.com');
      expect(response.body.data.token).toBe('mock-jwt-token');
    });

    it('should return error if email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@test.com',
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'existing@test.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'SUPER_ADMIN',
        isActive: true,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('mock-jwt-token');
    });

    it('should return error for invalid credentials', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'wrong@test.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return error for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        password: hashedPassword,
        isActive: true,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return error for inactive account', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12);
      
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        password: hashedPassword,
        isActive: false,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@test.com',
          password: 'Password123',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/profile', () => {
    it('should return user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+855 12 345 678',
        role: 'SUPER_ADMIN',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/profile')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@test.com');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/auth/profile');

      expect(response.status).toBe(401);
    });
  });
});
