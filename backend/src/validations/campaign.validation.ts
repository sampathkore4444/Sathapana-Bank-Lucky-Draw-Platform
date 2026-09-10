import { z } from 'zod';

export const createCampaignSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(255, 'Name too long'),
    description: z
      .string()
      .max(2000, 'Description too long')
      .optional(),
    type: z.enum([
      'TRANSACTION_BASED',
      'DEPOSIT_BASED',
      'ACCOUNT_OPENING',
      'MILESTONE',
      'REFERRAL',
      'HYBRID',
    ], { errorMap: () => ({ message: 'Invalid campaign type' }) }),
    startDate: z
      .string()
      .datetime('Invalid start date format'),
    endDate: z
      .string()
      .datetime('Invalid end date format'),
    drawDate: z
      .string()
      .datetime('Invalid draw date format'),
    eligibilityCriteria: z
      .object({
        customerTypes: z.array(z.string()).optional(),
        accountTypes: z.array(z.string()).optional(),
        minimumDeposit: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        geographicRestriction: z.array(z.string()).optional(),
        ageMinimum: z.number().int().min(18).max(100).optional(),
      })
      .optional(),
    entryRules: z
      .array(
        z.object({
          ruleId: z.string().optional(),
          trigger: z.string().min(1, 'Trigger required'),
          entriesPerAction: z.number().int().positive().optional(),
          amountIncrement: z.number().positive().optional(),
          entriesPerIncrement: z.number().int().positive().optional(),
          maxEntriesPerCustomer: z.number().int().positive().optional(),
          description: z.string().optional(),
        })
      )
      .optional(),
    drawSettings: z
      .object({
        drawType: z.enum(['RANDOM', 'TIERED', 'SCHEDULED', 'INSTANT']).optional(),
        numberOfWinners: z.number().int().positive().optional(),
        numberOfAlternates: z.number().int().positive().optional(),
        allowMultipleWins: z.boolean().optional(),
        verificationRequired: z.boolean().optional(),
      })
      .optional(),
    termsAndConditions: z
      .string()
      .max(10000, 'Terms too long')
      .optional(),
    notificationSettings: z
      .object({
        welcomeMessage: z.boolean().optional(),
        entryConfirmation: z.boolean().optional(),
        drawReminder: z.boolean().optional(),
        winnerAnnouncement: z.boolean().optional(),
      })
      .optional(),
  }),
});

export const updateCampaignSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(255, 'Name too long')
      .optional(),
    description: z
      .string()
      .max(2000, 'Description too long')
      .optional(),
    startDate: z
      .string()
      .datetime('Invalid start date format')
      .optional(),
    endDate: z
      .string()
      .datetime('Invalid end date format')
      .optional(),
    drawDate: z
      .string()
      .datetime('Invalid draw date format')
      .optional(),
    termsAndConditions: z
      .string()
      .max(10000, 'Terms too long')
      .optional(),
  }),
});

export const campaignIdSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid campaign ID format'),
  }),
});

export const approvalDecisionSchema = z.object({
  params: z.object({
    id: z
      .string()
      .uuid('Invalid campaign ID format'),
    level: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().min(1).max(3)),
  }),
  body: z.object({
    comment: z
      .string()
      .max(2000, 'Comment too long')
      .optional(),
  }),
});

export const campaignApprovalQuerySchema = z.object({
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
      .enum([
        'DRAFT',
        'PENDING_APPROVAL',
        'SCHEDULED',
        'ACTIVE',
        'DRAW_DAY',
        'DRAWN',
        'CLOSED',
        'CANCELLED',
      ])
      .optional(),
  }),
});
