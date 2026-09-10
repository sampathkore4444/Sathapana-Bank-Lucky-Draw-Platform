import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { executeDrawSchema, drawIdSchema, campaignDrawsSchema } from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { drawService } from '../services/draw.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, (error as Error).message || fallback, 500);
  }
};

// POST /draws - Execute a draw
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'DRAW_OPERATOR'),
  validate(executeDrawSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { campaignId, numberOfWinners = 1, numberOfAlternates = 3 } = req.body;
      const result = await drawService.executeDraw(
        { campaignId, numberOfWinners, numberOfAlternates },
        req.user!.userId
      );
      ApiResponseHelper.created(res, result, 'Draw executed successfully');
    } catch (error) {
      handleError(res, error, 'Failed to execute draw');
    }
  }
);

// GET /draws - List all draws
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as any;
    const { data, total, page, limit } = await drawService.list(query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch draws');
  }
});

// GET /draws/:id - Get draw by ID
router.get('/:id', authenticate, validate(drawIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const draw = await drawService.getById(req.params.id);
    ApiResponseHelper.success(res, draw);
  } catch (error) {
    handleError(res, error, 'Failed to fetch draw');
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
      const updated = await drawService.addWitness(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Witness added');
    } catch (error) {
      handleError(res, error, 'Failed to add witness');
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
      const { draw, isValid } = await drawService.verifyDraw(req.params.id, req.user!.userId);
      ApiResponseHelper.success(
        res,
        draw,
        isValid ? 'Draw verified successfully' : 'Draw verification failed'
      );
    } catch (error) {
      handleError(res, error, 'Failed to verify draw');
    }
  }
);

// GET /draws/campaign/:campaignId - Get draws for a campaign
router.get('/campaign/:campaignId', authenticate, validate(campaignDrawsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const draws = await drawService.getCampaignDraws(req.params.campaignId);
    ApiResponseHelper.success(res, draws);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaign draws');
  }
});

export default router;