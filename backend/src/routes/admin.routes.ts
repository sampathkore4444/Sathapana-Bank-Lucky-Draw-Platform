import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { adminService } from '../services/admin.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// GET /admin/dashboard - Get dashboard statistics
router.get(
  '/dashboard',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const dashboard = await adminService.getDashboard();
      ApiResponseHelper.success(res, dashboard);
    } catch (error) {
      handleError(res, error, 'Failed to fetch dashboard stats');
    }
  }
);

// GET /admin/reports/campaign-performance - Campaign performance report
router.get(
  '/reports/campaign-performance',
  authenticate,
  authorize('SUPER_ADMIN', 'MARKETING_MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await adminService.getCampaignPerformanceReport();
      ApiResponseHelper.success(res, report);
    } catch (error) {
      handleError(res, error, 'Failed to generate report');
    }
  }
);

// GET /admin/reports/winner-fulfillment - Winner fulfillment report
router.get(
  '/reports/winner-fulfillment',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const report = await adminService.getWinnerFulfillmentReport();
      ApiResponseHelper.success(res, report);
    } catch (error) {
      handleError(res, error, 'Failed to generate report');
    }
  }
);

// GET /admin/audit-logs - Get audit logs
router.get(
  '/audit-logs',
  authenticate,
  authorize('SUPER_ADMIN', 'COMPLIANCE_OFFICER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as any;
      const { data, total, page, limit } = await adminService.getAuditLogs(query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch audit logs');
    }
  }
);

// GET /admin/users - List all users
router.get(
  '/users',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as any;
      const { data, total, page, limit } = await adminService.getUsers(query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch users');
    }
  }
);

// PUT /admin/users/:id/role - Update user role
router.put(
  '/users/:id/role',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { role } = req.body;
      const user = await adminService.updateUserRole(req.params.id, role);
      ApiResponseHelper.success(res, user, 'User role updated');
    } catch (error) {
      handleError(res, error, 'Failed to update user role');
    }
  }
);

// PUT /admin/users/:id/status - Activate/deactivate user
router.put(
  '/users/:id/status',
  authenticate,
  authorize('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { isActive } = req.body;
      const user = await adminService.updateUserStatus(req.params.id, isActive);
      ApiResponseHelper.success(res, user, `User ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      handleError(res, error, 'Failed to update user status');
    }
  }
);

export default router;