import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema, refreshTokenSchema, logoutSchema } from '../validations';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AuthRequest } from '../types';
import { AppError } from '../utils/appError';
import { authService } from '../services/auth.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// POST /auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const result = await authService.register({ email, password, firstName, lastName, phone });
    ApiResponseHelper.created(res, result, 'Registration successful');
  } catch (error) {
    handleError(res, error, 'Registration failed');
  }
});

// POST /auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    ApiResponseHelper.success(res, result, 'Login successful');
  } catch (error) {
    handleError(res, error, 'Login failed');
  }
});

// POST /auth/refresh
router.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refresh(refreshToken);
    ApiResponseHelper.success(res, result, 'Token refreshed');
  } catch (error) {
    handleError(res, error, 'Token refresh failed');
  }
});

// POST /auth/logout
router.post('/logout', authenticate, validate(logoutSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken, req.user!.userId);
    ApiResponseHelper.success(res, null, 'Logged out successfully');
  } catch (error) {
    handleError(res, error, 'Logout failed');
  }
});

// GET /auth/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.getProfile(req.user!.userId);
    ApiResponseHelper.success(res, user);
  } catch (error) {
    handleError(res, error, 'Failed to fetch profile');
  }
});

// PUT /auth/profile
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await authService.updateProfile(req.user!.userId, { firstName, lastName, phone });
    ApiResponseHelper.success(res, user, 'Profile updated');
  } catch (error) {
    handleError(res, error, 'Failed to update profile');
  }
});

export default router;