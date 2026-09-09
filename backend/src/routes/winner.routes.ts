import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateWinnerStatusSchema, winnerIdSchema, campaignWinnersSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

const router = Router();

// GET /winners - List all winners
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, status, campaignId } = req.query as any;
    const skip = (page - 1) * limit;

    const where: any = { isAlternate: false };
    if (status) where.status = status;
    if (campaignId) {
      where.drawResult = { campaignId };
    }

    const [winners, total] = await Promise.all([
      prisma.drawWinner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prize: true,
          drawResult: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.drawWinner.count({ where }),
    ]);

    ApiResponseHelper.paginated(res, winners, total, page, limit);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch winners', 500);
  }
});

// GET /winners/:id - Get winner by ID
router.get('/:id', authenticate, validate(winnerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const winner = await prisma.drawWinner.findUnique({
      where: { id: req.params.id },
      include: {
        prize: true,
        drawResult: {
          include: {
            campaign: { select: { id: true, name: true, drawDate: true } },
          },
        },
      },
    });

    if (!winner) {
      ApiResponseHelper.notFound(res, 'Winner');
      return;
    }

    ApiResponseHelper.success(res, winner);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch winner', 500);
  }
});

// PUT /winners/:id/status - Update winner status
router.put(
  '/:id/status',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR'),
  validate(winnerIdSchema),
  validate(updateWinnerStatusSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, notes } = req.body;

      const winner = await prisma.drawWinner.findUnique({
        where: { id: req.params.id },
      });

      if (!winner) {
        ApiResponseHelper.notFound(res, 'Winner');
        return;
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        SELECTED: ['VERIFIED', 'DECLINED'],
        VERIFIED: ['CONTACTED', 'DECLINED'],
        CONTACTED: ['ACCEPTED', 'DECLINED'],
        ACCEPTED: ['FULFILLED'],
        DECLINED: [],
        FULFILLED: [],
        EXPIRED: [],
      };

      if (!validTransitions[winner.status]?.includes(status)) {
        ApiResponseHelper.error(
          res,
          `Cannot transition from ${winner.status} to ${status}`,
          400
        );
        return;
      }

      // Update timestamp based on status
      const updateData: any = { status, notes };
      if (status === 'VERIFIED') updateData.verifiedAt = new Date();
      if (status === 'CONTACTED') updateData.contactedAt = new Date();
      if (status === 'ACCEPTED') updateData.acceptedAt = new Date();
      if (status === 'FULFILLED') updateData.fulfilledAt = new Date();

      const updated = await prisma.drawWinner.update({
        where: { id: req.params.id },
        data: updateData,
        include: {
          prize: true,
          drawResult: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          entityType: 'WINNER',
          entityId: req.params.id,
          action: `STATUS_CHANGED_TO_${status}`,
          performedBy: req.user!.userId,
          details: { previousStatus: winner.status, newStatus: status },
        },
      });

      ApiResponseHelper.success(res, updated, 'Winner status updated');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to update winner status', 500);
    }
  }
);

// GET /winners/campaign/:campaignId - Get winners for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignWinnersSchema), async (req: AuthRequest, res: Response) => {
  try {
    const winners = await prisma.drawWinner.findMany({
      where: {
        isAlternate: false,
        drawResult: { campaignId: req.params.campaignId },
      },
      orderBy: { rank: 'asc' },
      include: {
        prize: true,
        drawResult: { select: { drawDate: true } },
      },
    });

    ApiResponseHelper.success(res, winners);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaign winners', 500);
  }
});

// GET /winners/customer/:customerId - Get wins for a customer
router.get('/customer/:customerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const wins = await prisma.drawWinner.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        prize: true,
        drawResult: {
          include: {
            campaign: { select: { id: true, name: true, drawDate: true } },
          },
        },
      },
    });

    ApiResponseHelper.success(res, wins);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch customer wins', 500);
  }
});

// POST /winners/:id/promote-alternate - Promote alternate to winner
router.post(
  '/:id/promote-alternate',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR'),
  validate(winnerIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const winner = await prisma.drawWinner.findUnique({
        where: { id: req.params.id },
      });

      if (!winner) {
        ApiResponseHelper.notFound(res, 'Winner');
        return;
      }

      if (!winner.isAlternate) {
        ApiResponseHelper.error(res, 'Can only promote alternates', 400);
        return;
      }

      // Find the original winner who declined
      const originalWinner = await prisma.drawWinner.findFirst({
        where: {
          drawResultId: winner.drawResultId,
          prizeId: winner.prizeId,
          isAlternate: false,
          status: { in: ['DECLINED', 'EXPIRED'] },
        },
      });

      if (!originalWinner) {
        ApiResponseHelper.error(res, 'No declined winner to replace', 400);
        return;
      }

      // Promote alternate
      const updated = await prisma.drawWinner.update({
        where: { id: req.params.id },
        data: {
          isAlternate: false,
          rank: originalWinner.rank,
          status: 'SELECTED',
        },
        include: {
          prize: true,
          drawResult: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      });

      ApiResponseHelper.success(res, updated, 'Alternate promoted to winner');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to promote alternate', 500);
    }
  }
);

export default router;
