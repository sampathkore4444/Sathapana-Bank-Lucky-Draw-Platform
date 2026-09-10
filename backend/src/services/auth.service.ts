import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/database';
import { generateToken } from '../middleware/auth';
import { AppError } from '../utils/appError';
import { hashToken } from '../utils/security';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  createdAt: true,
} as const;

const PROFILE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

// 30 days in milliseconds
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Only the SHA-256 digest of a refresh token is ever persisted, so a database
 * leak does not expose live tokens.
 */
export function hashRefreshToken(token: string): string {
  return hashToken(token);
}

export class AuthService {
  private buildAuthPayload(user: {
    id: string;
    email: string;
    role: string;
  }) {
    return { userId: user.id, email: user.email, role: user.role };
  }

  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new AppError('Email already registered', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'READ_ONLY',
      },
      select: USER_SELECT,
    });

    const token = generateToken(this.buildAuthPayload(user));

    return { user, token };
  }

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.createSession(user);
  }

  private async createSession(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }) {
    const token = generateToken(this.buildAuthPayload(user));
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
      refreshToken,
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const token = generateRefreshToken();

    await prisma.refreshToken.create({
      data: {
        userId,
        token: hashRefreshToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return token;
  }

  async refresh(refreshToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: hashRefreshToken(refreshToken) },
      include: { user: true },
    });

    if (!stored) {
      throw new AppError('Invalid refresh token', 401);
    }

    if (stored.revokedAt) {
      throw new AppError('Refresh token has been revoked', 401);
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError('Refresh token expired', 401);
    }

    if (!stored.user.isActive) {
      throw new AppError('Account is deactivated', 403);
    }

    // Rotate the token: revoke the old one and issue a new pair
    const token = generateToken(this.buildAuthPayload(stored.user));
    const newRefreshToken = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedByToken: hashRefreshToken(newRefreshToken) },
      }),
      prisma.refreshToken.create({
        data: {
          userId: stored.user.id,
          token: hashRefreshToken(newRefreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      }),
    ]);

    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        firstName: stored.user.firstName,
        lastName: stored.user.lastName,
        role: stored.user.role,
      },
      token,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token: hashRefreshToken(refreshToken), userId },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });

    return user;
  }
}

export const authService = new AuthService();
