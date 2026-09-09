import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCampaignSchema, updateCampaignSchema, campaignIdSchema } from '../validations';
import { AuthRequest, CampaignQuery } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

const router = Router();

// GET /campaigns - List all campaigns
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query as CampaignQuery;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { entries: true, prizes: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    ApiResponseHelper.paginated(res, campaigns, total, page, limit);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaigns', 500);
  }
});

// GET /campaigns/:id - Get campaign by ID
router.get('/:id', authenticate, validate(campaignIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        _count: { select: { entries: true, drawResults: true } },
      },
    });

    if (!campaign) {
      ApiResponseHelper.notFound(res, 'Campaign');
      return;
    }

    ApiResponseHelper.success(res, campaign);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaign', 500);
  }
});

// POST /campaigns - Create new campaign
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(createCampaignSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        description,
        type,
        startDate,
        endDate,
        drawDate,
        eligibilityCriteria,
        entryRules,
        drawSettings,
        termsAndConditions,
        notificationSettings,
      } = req.body;

      const campaign = await prisma.campaign.create({
        data: {
          name,
          description,
          type,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          drawDate: new Date(drawDate),
          eligibilityCriteria: eligibilityCriteria || {},
          entryRules: entryRules || [],
          drawSettings: drawSettings || {},
          termsAndConditions,
          notificationSettings: notificationSettings || {},
          createdBy: req.user!.userId,
        },
        include: {
          _count: { select: { entries: true, prizes: true } },
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaign.id,
          action: 'CREATED',
          performedBy: req.user!.userId,
          details: { campaignName: name },
        },
      });

      ApiResponseHelper.created(res, campaign, 'Campaign created successfully');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to create campaign', 500);
    }
  }
);

// PUT /campaigns/:id - Update campaign
router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(updateCampaignSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      // Can only update DRAFT or SCHEDULED campaigns
      if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
        ApiResponseHelper.error(res, 'Cannot update campaign in current status', 400);
        return;
      }

      const campaign = await prisma.campaign.update({
        where: { id: req.params.id },
        data: {
          ...req.body,
          startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
          endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
          drawDate: req.body.drawDate ? new Date(req.body.drawDate) : undefined,
          updatedBy: req.user!.userId,
        },
        include: {
          _count: { select: { entries: true, prizes: true } },
        },
      });

      ApiResponseHelper.success(res, campaign, 'Campaign updated successfully');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to update campaign', 500);
    }
  }
);

// DELETE /campaigns/:id - Delete campaign (only DRAFT)
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const existing = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!existing) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      if (existing.status !== 'DRAFT') {
        ApiResponseHelper.error(res, 'Can only delete draft campaigns', 400);
        return;
      }

      await prisma.campaign.delete({ where: { id: req.params.id } });

      ApiResponseHelper.success(res, null, 'Campaign deleted successfully');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to delete campaign', 500);
    }
  }
);

// POST /campaigns/:id/activate - Activate campaign
router.post(
  '/:id/activate',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
        ApiResponseHelper.error(res, 'Cannot activate campaign in current status', 400);
        return;
      }

      const updated = await prisma.campaign.update({
        where: { id: req.params.id },
        data: {
          status: 'ACTIVE',
          approvedBy: req.user!.userId,
          approvedAt: new Date(),
          updatedBy: req.user!.userId,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          entityType: 'CAMPAIGN',
          entityId: campaign.id,
          action: 'ACTIVATED',
          performedBy: req.user!.userId,
          details: { previousStatus: campaign.status },
        },
      });

      ApiResponseHelper.success(res, updated, 'Campaign activated successfully');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to activate campaign', 500);
    }
  }
);

// POST /campaigns/:id/pause - Pause campaign
router.post(
  '/:id/pause',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      if (campaign.status !== 'ACTIVE') {
        ApiResponseHelper.error(res, 'Can only pause active campaigns', 400);
        return;
      }

      const updated = await prisma.campaign.update({
        where: { id: req.params.id },
        data: { status: 'SCHEDULED', updatedBy: req.user!.userId },
      });

      ApiResponseHelper.success(res, updated, 'Campaign paused');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to pause campaign', 500);
    }
  }
);

// POST /campaigns/:id/close - Close campaign
router.post(
  '/:id/close',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      const updated = await prisma.campaign.update({
        where: { id: req.params.id },
        data: { status: 'CLOSED', updatedBy: req.user!.userId },
      });

      ApiResponseHelper.success(res, updated, 'Campaign closed');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to close campaign', 500);
    }
  }
);

// GET /campaigns/:id/stats - Get campaign statistics
router.get('/:id/stats', authenticate, validate(campaignIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { entries: true, prizes: true, drawResults: true } },
        entries: {
          select: { entriesEarned: true, verified: true, entryType: true, customerId: true },
        },
      },
    });

    if (!campaign) {
      ApiResponseHelper.notFound(res, 'Campaign');
      return;
    }

    const totalEntries = campaign.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
    const uniqueParticipants = new Set(campaign.entries.map((e) => e.customerId)).size;
    const verifiedEntries = campaign.entries.filter((e) => e.verified).length;

    const entryTypeBreakdown = campaign.entries.reduce((acc, e) => {
      acc[e.entryType] = (acc[e.entryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    ApiResponseHelper.success(res, {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      totalEntries,
      uniqueParticipants,
      verifiedEntries,
      unverifiedEntries: campaign.entries.length - verifiedEntries,
      totalPrizes: campaign._count.prizes,
      totalDraws: campaign._count.drawResults,
      entryTypeBreakdown,
    });
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaign stats', 500);
  }
});

export default router;
