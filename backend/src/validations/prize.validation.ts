import { z } from 'zod';

export const createPrizeSchema = z.object({
  body: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
    rank: z
      .number()
      .int()
      .positive('Rank must be positive'),
    name: z
      .string()
      .min(1, 'Prize name required')
      .max(255, 'Name too long'),
    category: z.enum([
      'VEHICLE',
      'ELECTRONICS',
      'GOLD',
      'JEWELRY',
      'CASH',
      'TRAVEL',
      'SERVICE',
      'MERCHANDISE',
    ], { errorMap: () => ({ message: 'Invalid prize category' }) }),
    description: z
      .string()
      .max(2000, 'Description too long')
      .optional(),
    quantity: z
      .number()
      .int()
      .positive('Quantity must be positive'),
    estimatedValue: z
      .number()
      .positive('Value must be positive'),
    currency: z
      .string()
      .length(3, 'Currency must be 3 characters')
      .optional()
      .default('USD'),
    vendorName: z
      .string()
      .max(255, 'Vendor name too long')
      .optional(),
    vendorContact: z
      .record(z.any())
      .optional(),
    fulfillmentInstructions: z
      .string()
      .max(5000, 'Instructions too long')
      .optional(),
    alternativesOffered: z
      .array(z.any())
      .optional(),
    termsAndConditions: z
      .string()
      .max(5000, 'Terms too long')
      .optional(),
  }),
});

export const updatePrizeSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Prize name required')
      .max(255, 'Name too long')
      .optional(),
    description: z
      .string()
      .max(2000, 'Description too long')
      .optional(),
    quantity: z
      .number()
      .int()
      .positive('Quantity must be positive')
      .optional(),
    estimatedValue: z
      .number()
      .positive('Value must be positive')
      .optional(),
    fulfillmentInstructions: z
      .string()
      .max(5000, 'Instructions too long')
      .optional(),
  }),
});

export const prizeIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid prize ID format'),
  }),
});

export const campaignPrizesSchema = z.object({
  params: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});
