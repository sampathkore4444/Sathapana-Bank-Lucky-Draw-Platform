import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateWinnerStatusSchema, winnerIdSchema, campaignWinnersSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { winnerService } from '../services/winner.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// GET /winners - List all winners
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as any;
    const { data, total, page, limit } = await winnerService.list(query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch winners');
  }
});

// GET /winners/:id - Get winner by ID
router.get('/:id', authenticate, validate(winnerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const winner = await winnerService.getById(req.params.id);
    ApiResponseHelper.success(res, winner);
  } catch (error) {
    handleError(res, error, 'Failed to fetch winner');
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
      const updated = await winnerService.updateStatus(req.params.id, { status, notes }, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Winner status updated');
    } catch (error) {
      handleError(res, error, 'Failed to update winner status');
    }
  }
);

// GET /winners/campaign/:campaignId - Get winners for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignWinnersSchema), async (req: AuthRequest, res: Response) => {
  try {
    const winners = await winnerService.getCampaignWinners(req.params.campaignId);
    ApiResponseHelper.success(res, winners);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaign winners');
  }
});

// GET /winners/customer/:customerId - Get wins for a customer
router.get('/customer/:customerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const wins = await winnerService.getCustomerWins(req.params.customerId);
    ApiResponseHelper.success(res, wins);
  } catch (error) {
    handleError(res, error, 'Failed to fetch customer wins');
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
      const updated = await winnerService.promoteAlternate(req.params.id);
      ApiResponseHelper.success(res, updated, 'Alternate promoted to winner');
    } catch (error) {
      handleError(res, error, 'Failed to promote alternate');
    }
  }
);

export default router;