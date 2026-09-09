import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { executeDrawSchema, drawIdSchema, campaignDrawsSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { DrawEngine } from '../services/drawEngine';

const router = Router();

// POST /draws - Execute a draw
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'DRAW_OPERATOR'),
  validate(executeDrawSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { campaignId, numberOfWinners = 1, numberOfAlternates = 3 } = req.body;

      // Verify user has permission for this campaign
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) {
        ApiResponseHelper.notFound(res, 'Campaign');
        return;
      }

      // Execute draw
      const drawEngine = new DrawEngine();
      const result = await drawEngine.executeDraw({
        campaignId,
        numberOfWinners,
        numberOfAlternates,
        allowMultipleWins: false,
      });

      // Update the draw result with executor info
      await prisma.drawResult.update({
        where: { id: result.drawId },
        data: {
          executedBy: [req.user!.userId],
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          entityType: 'DRAW',
          entityId: result.drawId,
          action: 'EXECUTED',
          performedBy: req.user!.userId,
          details: {
            campaignId,
            totalWinners: result.winners.length,
            totalAlternates: result.alternates.length,
          },
        },
      });

      ApiResponseHelper.created(res, result, 'Draw executed successfully');
    } catch (error: any) {
      ApiResponseHelper.error(res, error.message || 'Failed to execute draw', 500);
    }
  }
);

// GET /draws - List all draws
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query as any;
    const skip = (page - 1) * limit;

    const [draws, total] = await Promise.all([
      prisma.drawResult.findMany({
        skip,
        take: limit,
        orderBy: { drawDate: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
          winners: {
            where: { isAlternate: false },
            include: { prize: true },
          },
          _count: { select: { winners: true } },
        },
      }),
      prisma.drawResult.count(),
    ]);

    ApiResponseHelper.paginated(res, draws, total, page, limit);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch draws', 500);
  }
});

// GET /draws/:id - Get draw by ID
router.get('/:id', authenticate, validate(drawIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const draw = await prisma.drawResult.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: { select: { id: true, name: true, drawDate: true } },
        winners: {
          include: { prize: true },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!draw) {
      ApiResponseHelper.notFound(res, 'Draw');
      return;
    }

    ApiResponseHelper.success(res, draw);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch draw', 500);
  }
});

// POST /draws/:id/witness - Add witness to draw
router.post(
  '/:id/witness',
  authenticate,
  authorize('SUPER_ADMIN', 'DRAW_OPERATOR', 'COMPLIANCE_OFFICER'),
  validate(drawIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const draw = await prisma.drawResult.findUnique({
        where: { id: req.params.id },
      });

      if (!draw) {
        ApiResponseHelper.notFound(res, 'Draw');
        return;
      }

      // Check if user is already a witness
      if (draw.witnessedBy.includes(req.user!.userId)) {
        ApiResponseHelper.error(res, 'Already a witness', 400);
        return;
      }

      const updated = await prisma.drawResult.update({
        where: { id: req.params.id },
        data: {
          witnessedBy: [...draw.witnessedBy, req.user!.userId],
        },
      });

      ApiResponseHelper.success(res, updated, 'Witness added');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to add witness', 500);
    }
  }
);

// POST /draws/:id/verify - Verify draw results
router.post(
  '/:id/verify',
  authenticate,
  authorize('SUPER_ADMIN', 'COMPLIANCE_OFFICER'),
  validate(drawIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const draw = await prisma.drawResult.findUnique({
        where: { id: req.params.id },
      });

      if (!draw) {
        ApiResponseHelper.notFound(res, 'Draw');
        return;
      }

      const drawEngine = new DrawEngine();
      const isValid = await drawEngine.verifyDraw(req.params.id);

      const updated = await prisma.drawResult.update({
        where: { id: req.params.id },
        data: {
          isVerified: isValid,
          verifiedAt: new Date(),
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          entityType: 'DRAW',
          entityId: req.params.id,
          action: 'VERIFIED',
          performedBy: req.user!.userId,
          details: { isValid },
        },
      });

      ApiResponseHelper.success(
        res,
        updated,
        isValid ? 'Draw verified successfully' : 'Draw verification failed'
      );
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to verify draw', 500);
    }
  }
);

// GET /draws/campaign/:campaignId - Get draws for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignDrawsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const draws = await prisma.drawResult.findMany({
      where: { campaignId: req.params.campaignId },
      orderBy: { drawDate: 'desc' },
      include: {
        winners: {
          where: { isAlternate: false },
          include: { prize: true },
        },
        _count: { select: { winners: true } },
      },
    });

    ApiResponseHelper.success(res, draws);
  } catch (error) {
    ApiResponseHelper.error(res, 'Failed to fetch campaign draws', 500);
  }
});

export default router;
