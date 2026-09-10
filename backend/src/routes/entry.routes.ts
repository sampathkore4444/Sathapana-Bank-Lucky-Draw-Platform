import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerEntrySchema, customerIdSchema, eligibilitySchema } from '../validations';
import { AuthRequest, EntryQuery } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { entryService } from '../services/entry.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// POST /entries - Register a new entry
router.post('/', authenticate, validate(registerEntrySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { entry, entriesEarned } = await entryService.register(req.body, req.user!.userId);
    ApiResponseHelper.created(res, entry, `Earned ${entriesEarned} entries`);
  } catch (error) {
    handleError(res, error, 'Failed to register entry');
  }
});

// GET /entries - List all entries
router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'COMPLIANCE_OFFICER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as EntryQuery;
      const { data, total, page, limit } = await entryService.list(query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch entries');
    }
  }
);

// GET /entries/customer/:customerId - Get customer's entry history
router.get('/customer/:customerId', authenticate, validate(customerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as EntryQuery;
    const { data, total, page, limit } = await entryService.getCustomerEntries(req.params.customerId, query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch customer entries');
  }
});

// GET /entries/customer/:customerId/summary - Get customer entry summary
router.get('/customer/:customerId/summary', authenticate, validate(customerIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const summary = await entryService.getCustomerSummary(req.params.customerId);
    ApiResponseHelper.success(res, summary);
  } catch (error) {
    handleError(res, error, 'Failed to fetch customer summary');
  }
});

// GET /entries/eligibility/:customerId/:campaignId - Check eligibility
router.get('/eligibility/:customerId/:campaignId', authenticate, validate(eligibilitySchema), async (req: AuthRequest, res: Response) => {
  try {
    const eligibility = await entryService.checkEligibility(req.params.customerId, req.params.campaignId);
    ApiResponseHelper.success(res, eligibility);
  } catch (error) {
    handleError(res, error, 'Failed to check eligibility');
  }
});

export default router;