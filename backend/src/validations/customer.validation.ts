import { z } from 'zod';

export const customerLoginSchema = z.object({
  body: z.object({
    customerId: z
      .string()
      .min(1, 'Customer ID required')
      .max(50, 'Customer ID too long'),
    phone: z
      .string()
      .min(1, 'Phone number required')
      .max(30, 'Phone number too long')
      .optional(),
  }),
});

export const customerPathIdSchema = z.object({
  params: z.object({
    customerId: z
      .string()
      .min(1, 'Customer ID required')
      .max(50, 'Customer ID too long'),
  }),
});

export const customerCampaignQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .pipe(z.number().int().min(1).max(100)),
    status: z
      .enum(['SCHEDULED', 'ACTIVE', 'DRAW_DAY'])
      .optional(),
    type: z
      .enum([
        'TRANSACTION_BASED',
        'DEPOSIT_BASED',
        'ACCOUNT_OPENING',
        'MILESTONE',
        'REFERRAL',
        'HYBRID',
      ])
      .optional(),
  }),
});

export const customerEntryQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
  }),
});

export const customerNotificationIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid notification ID format'),
  }),
});

export const customerEligibilitySchema = z.object({
  params: z.object({
    customerId: z
      .string()
      .min(1, 'Customer ID required')
      .max(50, 'Customer ID too long'),
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});