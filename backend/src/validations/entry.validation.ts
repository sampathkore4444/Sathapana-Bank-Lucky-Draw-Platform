import { z } from 'zod';

export const registerEntrySchema = z.object({
  body: z.object({
    customerId: z
      .string()
      .min(1, 'Customer ID required')
      .max(50, 'Customer ID too long')
      .regex(/^[A-Z0-9-]+$/, 'Invalid customer ID format'),
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
    accountId: z
      .string()
      .max(50, 'Account ID too long')
      .optional(),
    entryType: z.enum([
      'ACCOUNT_OPENED',
      'DEPOSIT',
      'FUND_TRANSFER',
      'MOBILE_TRANSACTION',
      'REFERRAL',
      'MILESTONE_ACHIEVED',
      'MANUAL',
    ], { errorMap: () => ({ message: 'Invalid entry type' }) }),
    triggerTransactionId: z
      .string()
      .max(100, 'Transaction ID too long')
      .optional(),
    metadata: z
      .record(z.any())
      .optional(),
  }),
});

export const entryQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().positive()),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50))
      .pipe(z.number().int().min(1).max(100)),
    customerId: z
      .string()
      .optional(),
    campaignId: z
      .string()
      .uuid()
      .optional(),
    verified: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  }),
});

export const customerIdSchema = z.object({
  params: z.object({
    customerId: z
      .string()
      .min(1, 'Customer ID required')
      .max(50, 'Customer ID too long'),
  }),
});

export const eligibilitySchema = z.object({
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
