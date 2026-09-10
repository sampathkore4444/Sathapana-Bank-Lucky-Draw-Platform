import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import { publicWinnersSchema } from '../validations';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { claimService } from '../services/claim.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// GET /public/campaigns/:campaignId/winners - Public, approved winners for a campaign
router.get(
  '/campaigns/:campaignId/winners',
  validate(publicWinnersSchema),
  async (req: Request, res: Response) => {
    try {
      const winners = await claimService.getPublicWinners(req.params.campaignId);
      ApiResponseHelper.success(res, winners);
    } catch (error) {
      handleError(res, error, 'Failed to fetch public winners');
    }
  }
);

export default router;