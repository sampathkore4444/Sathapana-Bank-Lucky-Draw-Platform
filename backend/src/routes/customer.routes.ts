import { Router, Request, Response } from 'express';
import { validate } from '../middleware/validate';
import {
  customerPathIdSchema,
  customerCampaignQuerySchema,
  customerEntryQuerySchema,
  customerNotificationIdSchema,
  customerEligibilitySchema,
} from '../validations';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { customerService } from '../services/customer.service';

const router: Router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

const getCustomerId = (req: Request): string | undefined => {
  const header = req.headers['x-customer-id'];
  if (header) return String(header);
  const query = req.query.customerId;
  if (query) return String(query);
  return undefined;
};

const requireCustomerId = (req: Request, res: Response): string | undefined => {
  const customerId = getCustomerId(req);
  if (!customerId) {
    ApiResponseHelper.unauthorized(res, 'X-Customer-Id header or customerId query parameter required');
    return undefined;
  }
  return customerId;
};

// GET /customer/dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res);
  if (!customerId) return;
  try {
    const dashboard = await customerService.getDashboard(customerId);
    ApiResponseHelper.success(res, dashboard);
  } catch (error) {
    handleError(res, error, 'Failed to fetch dashboard');
  }
});

// GET /customer/campaigns - Public campaign catalogue
router.get('/campaigns', validate(customerCampaignQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = req.query as any;
    const { data, total, page, limit } = await customerService.listCampaigns(query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaigns');
  }
});

// GET /customer/campaigns/:campaignId/eligibility/:customerId
router.get(
  '/campaigns/:campaignId/eligibility/:customerId',
  validate(customerEligibilitySchema),
  async (req: Request, res: Response) => {
    try {
      const result = await customerService.checkEligibility(req.params.customerId, req.params.campaignId);
      ApiResponseHelper.success(res, result);
    } catch (error) {
      handleError(res, error, 'Failed to check eligibility');
    }
  }
);

// GET /customer/entries - Customer entry history
router.get('/entries', validate(customerEntryQuerySchema), async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res);
  if (!customerId) return;
  try {
    const query = req.query as any;
    const { data, total, page, limit } = await customerService.getEntries(customerId, query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch entries');
  }
});

// GET /customer/wins - Customer wins
router.get('/wins', async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res);
  if (!customerId) return;
  try {
    const wins = await customerService.getWins(customerId);
    ApiResponseHelper.success(res, wins);
  } catch (error) {
    handleError(res, error, 'Failed to fetch wins');
  }
});

// GET /customer/notifications
router.get('/notifications', validate(customerEntryQuerySchema), async (req: Request, res: Response) => {
  const customerId = requireCustomerId(req, res);
  if (!customerId) return;
  try {
    const query = req.query as any;
    const { notifications, total, page, limit } = await customerService.getNotifications(customerId, query);
    ApiResponseHelper.paginated(res, notifications, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch notifications');
  }
});

// PUT /customer/notifications/:id/read
router.put(
  '/notifications/:id/read',
  validate(customerNotificationIdSchema),
  async (req: Request, res: Response) => {
    const customerId = requireCustomerId(req, res);
    if (!customerId) return;
    try {
      await customerService.markNotificationRead(req.params.id, customerId);
      ApiResponseHelper.success(res, null, 'Notification marked as read');
    } catch (error) {
      handleError(res, error, 'Failed to mark notification as read');
    }
  }
);

export default router;