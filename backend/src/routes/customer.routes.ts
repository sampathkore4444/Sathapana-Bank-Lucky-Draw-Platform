import { Router, Response } from 'express';
import { validate } from '../middleware/validate';
import { authenticate, authorize, resolveCustomer, isCustomer } from '../middleware/auth';
import {
  customerLoginSchema,
  customerPathIdSchema,
  customerCampaignQuerySchema,
  customerEntryQuerySchema,
  customerNotificationIdSchema,
  customerEligibilitySchema,
} from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { customerService } from '../services/customer.service';

const router: Router = Router();

// Roles allowed to act on behalf of (or query) customers by customerId.
const CUSTOMER_ROLES = [
  'SUPER_ADMIN',
  'CAMPAIGN_MANAGER',
  'MARKETING_MANAGER',
  'PRIZE_COORDINATOR',
  'COMPLIANCE_OFFICER',
  'READ_ONLY',
];

const AUTHORIZED_ROLES = ['CUSTOMER', ...CUSTOMER_ROLES];

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

/**
 * Enforce that a CUSTOMER token can only access its own customerId.
 * Staff tokens may access any customerId.
 */
const enforceOwnCustomer = (req: AuthRequest, res: Response, targetCustomerId: string): boolean => {
  if (isCustomer(req.user) && req.user!.customerId !== targetCustomerId) {
    ApiResponseHelper.forbidden(res, 'Cannot access another customer\'s data');
    return false;
  }
  return true;
};

// POST /customer/login - Customer authentication via core banking
router.post('/login', validate(customerLoginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.body.customerId as string;
    const session = await customerService.login(customerId);
    ApiResponseHelper.success(res, session, 'Login successful');
  } catch (error) {
    handleError(res, error, 'Login failed');
  }
});

// GET /customer/me - Current authenticated customer identity
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    ApiResponseHelper.unauthorized(res, 'Not authenticated');
    return;
  }
  ApiResponseHelper.success(res, {
    role: req.user.role,
    customerId: req.user.customerId,
    userId: req.user.userId,
  });
});

// GET /customer/dashboard
router.get(
  '/dashboard',
  authenticate,
  authorize('CUSTOMER', ...CUSTOMER_ROLES),
  resolveCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const dashboard = await customerService.getDashboard(req.customerId!);
      ApiResponseHelper.success(res, dashboard);
    } catch (error) {
      handleError(res, error, 'Failed to fetch dashboard');
    }
  }
);

// GET /customer/campaigns - Public campaign catalogue
router.get('/campaigns', validate(customerCampaignQuerySchema), async (req: AuthRequest, res: Response) => {
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
  authenticate,
  authorize('CUSTOMER', ...CUSTOMER_ROLES),
  validate(customerEligibilitySchema),
  async (req: AuthRequest, res: Response) => {
    if (!enforceOwnCustomer(req, res, req.params.customerId)) return;
    try {
      const result = await customerService.checkEligibility(req.params.customerId, req.params.campaignId);
      ApiResponseHelper.success(res, result);
    } catch (error) {
      handleError(res, error, 'Failed to check eligibility');
    }
  }
);

// GET /customer/entries - Customer entry history
router.get(
  '/entries',
  authenticate,
  authorize(...AUTHORIZED_ROLES),
  resolveCustomer,
  validate(customerEntryQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as any;
      const { data, total, page, limit } = await customerService.getEntries(req.customerId!, query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch entries');
    }
  }
);

// GET /customer/wins - Customer wins
router.get(
  '/wins',
  authenticate,
  authorize(...AUTHORIZED_ROLES),
  resolveCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const wins = await customerService.getWins(req.customerId!);
      ApiResponseHelper.success(res, wins);
    } catch (error) {
      handleError(res, error, 'Failed to fetch wins');
    }
  }
);

// GET /customer/notifications
router.get(
  '/notifications',
  authenticate,
  authorize(...AUTHORIZED_ROLES),
  resolveCustomer,
  validate(customerEntryQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as any;
      const { notifications, total, page, limit } = await customerService.getNotifications(req.customerId!, query);
      ApiResponseHelper.paginated(res, notifications, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch notifications');
    }
  }
);

// PUT /customer/notifications/:id/read
router.put(
  '/notifications/:id/read',
  authenticate,
  authorize(...AUTHORIZED_ROLES),
  resolveCustomer,
  validate(customerNotificationIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      await customerService.markNotificationRead(req.params.id, req.customerId!);
      ApiResponseHelper.success(res, null, 'Notification marked as read');
    } catch (error) {
      handleError(res, error, 'Failed to mark notification as read');
    }
  }
);

export default router;