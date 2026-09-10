import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email format')
      .max(255, 'Email too long'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase, one lowercase, and one number'
      ),
    firstName: z
      .string()
      .min(1, 'First name required')
      .max(100, 'First name too long')
      .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters'),
    lastName: z
      .string()
      .min(1, 'Last name required')
      .max(100, 'Last name too long')
      .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters'),
    phone: z
      .string()
      .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format')
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Invalid email format'),
    password: z
      .string()
      .min(1, 'Password required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token required')
      .max(512, 'Refresh token too long'),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token required')
      .max(512, 'Refresh token too long'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name required')
      .max(100, 'First name too long')
      .regex(/^[a-zA-Z\s]+$/, 'First name can only contain letters')
      .optional(),
    lastName: z
      .string()
      .min(1, 'Last name required')
      .max(100, 'Last name too long')
      .regex(/^[a-zA-Z\s]+$/, 'Last name can only contain letters')
      .optional(),
    phone: z
      .string()
      .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format')
      .optional(),
  }),
});
