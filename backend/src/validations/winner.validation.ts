import { z } from 'zod';

export const updateWinnerStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'SELECTED',
      'VERIFIED',
      'CONTACTED',
      'ACCEPTED',
      'DECLINED',
      'FULFILLED',
      'EXPIRED',
    ], { errorMap: () => ({ message: 'Invalid winner status' }) }),
    notes: z
      .string()
      .max(2000, 'Notes too long')
      .optional(),
  }),
});

export const winnerIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid winner ID format'),
  }),
});

export const campaignWinnersSchema = z.object({
  params: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});

export const winnerQuerySchema = z.object({
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
    status: z
      .enum([
        'SELECTED',
        'VERIFIED',
        'CONTACTED',
        'ACCEPTED',
        'DECLINED',
        'FULFILLED',
        'EXPIRED',
      ])
      .optional(),
    campaignId: z
      .string()
      .uuid()
      .optional(),
  }),
});
