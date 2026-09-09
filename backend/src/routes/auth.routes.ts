import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { generateToken, authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema } from '../validations';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AuthRequest } from '../types';

const router = Router();

// POST /auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      ApiResponseHelper.error(res, 'Email already registered', 409);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'READ_ONLY',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    ApiResponseHelper.created(res, { user, token }, 'Registration successful');
  } catch (error) {
    ApiResponseHelper.error(res, 'Registration failed', 500);
  }
});

// POST /auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      ApiResponseHelper.unauthorized(res, 'Invalid credentials');
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      ApiResponseHelper.unauthorized(res, 'Invalid credentials');
      return;
    }

    // Check if active
    if (!user.isActive) {
      ApiResponseHelper.forbidden(res, 'Account is deactivated');
      return;
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    ApiResponseHelper.success(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      token,
    }, 'Login successful');
  } catch (error) {
    ApiResponseHelper.error(res, 'Login failed', 500);
  }
});

// GET /auth/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      ApiResponseHelper.notFound(res, 'User');
      return;
    }

    ApiResponseHelper.success(res, user);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch profile', 500);
  }
});

// PUT /auth/profile
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { firstName, lastName, phone },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
      },
    });

    ApiResponseHelper.success(res, user, 'Profile updated');
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to update profile', 500);
  }
});

export default router;
