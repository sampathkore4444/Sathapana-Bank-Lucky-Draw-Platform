import { z } from 'zod';

export const executeDrawSchema = z.object({
  body: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
    numberOfWinners: z
      .number()
      .int()
      .positive('Must be at least 1')
      .max(100, 'Cannot exceed 100 winners')
      .optional()
      .default(1),
    numberOfAlternates: z
      .number()
      .int()
      .min(0)
      .max(50, 'Cannot exceed 50 alternates')
      .optional()
      .default(3),
    drawType: z
      .enum(['RANDOM', 'TIERED', 'SCHEDULED', 'INSTANT'])
      .optional(),
    customerId: z
      .string()
      .min(1)
      .max(50)
      .optional(),
  }),
});

export const drawIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid draw ID format'),
  }),
});

export const campaignDrawsSchema = z.object({
  params: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});
