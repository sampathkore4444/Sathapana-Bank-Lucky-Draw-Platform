import { z } from 'zod';

export const claimWinnerIdSchema = z.object({
  params: z.object({
    winnerId: z
      .string()
      .uuid('Invalid winner ID format'),
  }),
});

export const claimIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid claim ID format'),
  }),
});

export const claimQuerySchema = z.object({
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
      .enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED'])
      .optional(),
  }),
});

export const createClaimSchema = z.object({
  body: z.object({
    winnerId: z
      .string()
      .uuid('Invalid winner ID format'),
  }),
});

export const addDocumentSchema = z.object({
  body: z.object({
    type: z.enum([
      'ID_PROOF',
      'CLAIM_FORM',
      'TAX_FORM',
      'CONSENT',
      'PROOF_OF_ADDRESS',
      'OTHER',
    ], { errorMap: () => ({ message: 'Invalid document type' }) }),
    filePath: z
      .string()
      .min(1, 'File path required')
      .max(1000, 'File path too long'),
    mimeType: z
      .string()
      .min(1, 'MIME type required')
      .max(100, 'MIME type too long'),
    size: z
      .number()
      .int()
      .nonnegative('Size must be non-negative'),
    notes: z
      .string()
      .max(2000, 'Notes too long')
      .optional(),
  }),
});

export const verifyDocumentSchema = z.object({
  body: z.object({
    status: z.enum(['VERIFIED', 'REJECTED'], {
      errorMap: () => ({ message: 'Invalid document status' }),
    }),
    notes: z
      .string()
      .max(2000, 'Notes too long')
      .optional(),
  }),
});

export const reviewClaimSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED'], {
      errorMap: () => ({ message: 'Invalid claim status' }),
    }),
    decisionNote: z
      .string()
      .max(2000, 'Note too long')
      .optional(),
  }),
});

export const publicWinnersSchema = z.object({
  params: z.object({
    campaignId: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});