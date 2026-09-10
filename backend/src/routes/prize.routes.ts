import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPrizeSchema, updatePrizeSchema, prizeIdSchema, campaignPrizesSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { prizeService } from '../services/prize.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// GET /prizes - List all prizes
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as any;
    const { data, total, page, limit } = await prizeService.list(query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch prizes');
  }
});

// GET /prizes/:id - Get prize by ID
router.get('/:id', authenticate, validate(prizeIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const prize = await prizeService.getById(req.params.id);
    ApiResponseHelper.success(res, prize);
  } catch (error) {
    handleError(res, error, 'Failed to fetch prize');
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
      const prize = await prizeService.create(req.body);
      ApiResponseHelper.created(res, prize, 'Prize created successfully');
    } catch (error) {
      handleError(res, error, 'Failed to create prize');
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
      const updated = await prizeService.update(req.params.id, req.body);
      ApiResponseHelper.success(res, updated, 'Prize updated');
    } catch (error) {
      handleError(res, error, 'Failed to update prize');
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
      await prizeService.delete(req.params.id);
      ApiResponseHelper.success(res, null, 'Prize deleted');
    } catch (error) {
      handleError(res, error, 'Failed to delete prize');
    }
  }
);

// GET /prizes/campaign/:campaignId - Get prizes for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignPrizesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const prizes = await prizeService.getCampaignPrizes(req.params.campaignId);
    ApiResponseHelper.success(res, prizes);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaign prizes');
  }
});

export default router;