import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPrizeSchema, updatePrizeSchema, prizeIdSchema, campaignPrizesSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

const router = Router();

// GET /prizes - List all prizes
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, campaignId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;

    const [prizes, total] = await Promise.all([
      prisma.prize.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ campaignId: 'asc' }, { rank: 'asc' }],
        include: {
          campaign: { select: { id: true, name: true } },
          _count: { select: { winners: true } },
        },
      }),
      prisma.prize.count({ where }),
    ]);

    ApiResponseHelper.paginated(res, prizes, total, page, limit);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch prizes', 500);
  }
});

// GET /prizes/:id - Get prize by ID
router.get('/:id', authenticate, validate(prizeIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const prize = await prisma.prize.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { id: true, name: true } },
        winners: {
          select: {
            id: true,
            customerId: true,
            status: true,
            verifiedAt: true,
            fulfilledAt: true,
          },
        },
      },
    });

    if (!prize) {
      ApiResponseHelper.notFound(res, 'Prize');
      return;
    }

    ApiResponseHelper.success(res, prize);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch prize', 500);
  }
});

// POST /prizes - Create new prize
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'PRIZE_COORDINATOR'),
  validate(createPrizeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        campaignId,
        rank,
        name,
        category,
        description,
        quantity,
        estimatedValue,
        currency,
        vendorName,
        vendorContact,
        fulfillmentInstructions,
        alternativesOffered,
        termsAndConditions,
      } = req.body;

      // Verify campaign exists
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      const prize = await prisma.prize.create({
        data: {
          campaignId,
          rank,
          name,
          category,
          description,
          quantity,
          estimatedValue,
          currency: currency || 'USD',
          vendorName,
          vendorContact: vendorContact || {},
          fulfillmentInstructions,
          alternativesOffered: alternativesOffered || [],
          termsAndConditions,
        },
        include: {
          campaign: { select: { id: true, name: true } },
        },
      });

      ApiResponseHelper.created(res, prize, 'Prize created successfully');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to create prize', 500);
    }
  }
);

// PUT /prizes/:id - Update prize
router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR'),
  validate(updatePrizeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const prize = await prisma.prize.findUnique({
        where: { id: req.params.id },
      });

      if (!prize) {
        ApiResponseHelper.notFound(res, 'Prize');
        return;
      }

      const updated = await prisma.prize.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          campaign: { select: { id: true, name: true } },
        },
      });

      ApiResponseHelper.success(res, updated, 'Prize updated');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to update prize', 500);
    }
  }
);

// DELETE /prizes/:id - Delete prize
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validate(prizeIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const prize = await prisma.prize.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { winners: true } } },
      });

      if (!prize) {
        ApiResponseHelper.notFound(res, 'Prize');
        return;
      }

      if (prize._count.winners > 0) {
        ApiResponseHelper.error(res, 'Cannot delete prize with assigned winners', 400);
        return;
      }

      await prisma.prize.delete({ where: { id: req.params.id } });

      ApiResponseHelper.success(res, null, 'Prize deleted');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to delete prize', 500);
    }
  }
);

// GET /prizes/campaign/:campaignId - Get prizes for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignPrizesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const prizes = await prisma.prize.findMany({
      where: { campaignId: req.params.campaignId },
      orderBy: { rank: 'asc' },
      include: {
        _count: { select: { winners: true } },
      },
    });

    ApiResponseHelper.success(res, prizes);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaign prizes', 500);
  }
});

export default router;
