import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerEntrySchema, customerIdSchema, eligibilitySchema } from '../validations';
import { AuthRequest, EntryQuery } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

const router = Router();

// POST /entries - Register a new entry
router.post('/', authenticate, validate(registerEntrySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, campaignId, accountId, entryType, triggerTransactionId, metadata } = req.body;

    // Check campaign exists and is active
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      ApiResponseHelper.notFound(res, 'Campaign');
      return;
    }

    if (campaign.status !== 'ACTIVE' && campaign.status !== 'DRAW_DAY') {
      ApiResponseHelper.error(res, 'Campaign is not active', 400);
      return;
    }

    // Check if within campaign dates
    const now = new Date();
    if (now < campaign.startDate || now > campaign.endDate) {
      ApiResponseHelper.error(res, 'Campaign is not within active dates', 400);
      return;
    }

    // Check for duplicate entry
    if (triggerTransactionId) {
      const existingEntry = await prisma.customerEntry.findUnique({
        where: {
          campaignId_customerId_triggerTransactionId: {
            campaignId,
            customerId,
            triggerTransactionId,
          },
        },
      });

      if (existingEntry) {
        ApiResponseHelper.error(res, 'Entry already registered for this transaction', 409);
        return;
      }
    }

    // Get current cumulative entries
    const previousEntries = await prisma.customerEntry.aggregate({
      where: { campaignId, customerId },
      _sum: { entriesEarned: true },
    });

    const currentCumulative = previousEntries._sum.entriesEarned || 0;

    // Calculate entries based on rule
    const entryRules = campaign.entryRules as any[];
    let entriesEarned = 1; // Default

    // Find matching rule
    const matchingRule = entryRules.find((rule) => rule.trigger === entryType);
    if (matchingRule) {
      entriesEarned = matchingRule.entriesPerAction || matchingRule.entriesPerIncrement || 1;
    }

    const newEntry = await prisma.customerEntry.create({
      data: {
        customerId,
        campaignId,
        accountId,
        entryType,
        entriesEarned,
        cumulativeEntries: currentCumulative + entriesEarned,
        triggerTransactionId,
        verified: true,
        verificationSource: 'SYSTEM',
        metadata: metadata || {},
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'ENTRY',
        entityId: newEntry.id,
        action: 'CREATED',
        performedBy: req.user!.userId,
        details: { customerId, campaignId, entriesEarned },
      },
    });

    ApiResponseHelper.created(res, newEntry, `Earned ${entriesEarned} entries`);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to register entry', 500);
  }
});

// GET /entries - List all entries
router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'COMPLIANCE_OFFICER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { page = 1, limit = 50, customerId, campaignId, verified } = req.query as EntryQuery;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (customerId) where.customerId = customerId;
      if (campaignId) where.campaignId = campaignId;
      if (verified !== undefined) where.verified = verified;

      const [entries, total] = await Promise.all([
        prisma.customerEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy: { entryDate: 'desc' },
        }),
        prisma.customerEntry.count({ where }),
      ]);

      ApiResponseHelper.paginated(res, entries, total, page, limit);
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to fetch entries', 500);
    }
  }
);

// GET /entries/customer/:customerId - Get customer's entry history
router.get('/customer/:customerId', authenticate, validate(customerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 20 } = req.query as EntryQuery;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.customerEntry.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.customerEntry.count({ where: { customerId } }),
    ]);

    ApiResponseHelper.paginated(res, entries, total, page, limit);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch customer entries', 500);
  }
});

// GET /entries/customer/:customerId/summary - Get customer entry summary
router.get('/customer/:customerId/summary', authenticate, validate(customerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId } = req.params;

    // Get all campaigns with entries for this customer
    const campaigns = await prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'DRAW_DAY', 'DRAWN', 'CLOSED'] } },
      include: {
        entries: {
          where: { customerId },
          select: { entriesEarned: true, entryDate: true },
        },
        _count: { select: { entries: true } },
      },
    });

    const summary = campaigns
      .filter((c) => c.entries.length > 0)
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        campaignStatus: c.status,
        totalEntries: c.entries.reduce((sum, e) => sum + e.entriesEarned, 0),
        lastEntryDate: c.entries[0]?.entryDate,
        totalParticipants: c._count.entries,
      }));

    ApiResponseHelper.success(res, { customerId, campaigns: summary });
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch customer summary', 500);
  }
});

// GET /entries/eligibility/:customerId/:campaignId - Check eligibility
router.get('/eligibility/:customerId/:campaignId', authenticate, validate(eligibilitySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { customerId, campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        entries: {
          where: { customerId },
          select: { entriesEarned: true, entryDate: true },
        },
      },
    });

    if (!campaign) {
      ApiResponseHelper.notFound(res, 'Campaign');
      return;
    }

    const totalEntries = campaign.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
    const eligibilityCriteria = campaign.eligibilityCriteria as any;
    const maxEntries = eligibilityCriteria?.maxEntriesPerCustomer || 50;

    ApiResponseHelper.success(res, {
      customerId,
      campaignId,
      eligible: campaign.status === 'ACTIVE' && totalEntries < maxEntries,
      currentEntries: totalEntries,
      maxEntries,
      campaignStatus: campaign.status,
    });
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to check eligibility', 500);
  }
});

export default router;
