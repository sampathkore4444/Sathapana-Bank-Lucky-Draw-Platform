import { Router, Response } from 'express';
import prisma from '../config/database';
import { authenticate, authorize } from '../middleware/auth';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';

const router = Router();

// GET /admin/dashboard - Get dashboard statistics
router.get(
  '/dashboard',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const [
        totalCampaigns,
        activeCampaigns,
        totalEntries,
        totalWinners,
        totalPrizes,
        recentEntries,
      ] = await Promise.all([
        prisma.campaign.count(),
        prisma.campaign.count({ where: { status: 'ACTIVE' } }),
        prisma.customerEntry.count(),
        prisma.drawWinner.count({ where: { isAlternate: false } }),
        prisma.prize.aggregate({ _sum: { estimatedValue: true } }),
        prisma.customerEntry.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            campaign: { select: { name: true } },
          },
        }),
      ]);

      // Get entries by day for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const entriesByDay = await prisma.customerEntry.groupBy({
        by: ['entryDate'],
        where: {
          entryDate: { gte: thirtyDaysAgo },
        },
        _count: { id: true },
        orderBy: { entryDate: 'asc' },
      });

      // Get campaigns by status
      const campaignsByStatus = await prisma.campaign.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      ApiResponseHelper.success(res, {
        overview: {
          totalCampaigns,
          activeCampaigns,
          totalEntries,
          totalWinners,
          totalPrizeValue: totalPrizes._sum.estimatedValue || 0,
        },
        recentEntries: recentEntries.map((e) => ({
          id: e.id,
          customerId: e.customerId,
          campaignName: e.campaign.name,
          entriesEarned: e.entriesEarned,
          entryDate: e.entryDate,
        })),
        entriesByDay: entriesByDay.map((e) => ({
          date: e.entryDate,
          count: e._count.id,
        })),
        campaignsByStatus: campaignsByStatus.map((c) => ({
          status: c.status,
          count: c._count.id,
        })),
      });
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to fetch dashboard stats', 500);
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
      const campaigns = await prisma.campaign.findMany({
        include: {
          _count: { select: { entries: true, prizes: true, drawResults: true } },
          entries: {
            select: { entriesEarned: true, customerId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const report = campaigns.map((c) => {
        const uniqueParticipants = new Set(c.entries.map((e) => e.customerId)).size;
        const totalEntries = c.entries.reduce((sum, e) => sum + e.entriesEarned, 0);

        return {
          campaignId: c.id,
          campaignName: c.name,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          totalEntries,
          uniqueParticipants,
          totalPrizes: c._count.prizes,
          totalDraws: c._count.drawResults,
          entryGrowthRate:
            c.entries.length > 0
              ? ((totalEntries / Math.max(uniqueParticipants, 1)) * 100).toFixed(2) + '%'
              : '0%',
        };
      });

      ApiResponseHelper.success(res, report);
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to generate report', 500);
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
      const winners = await prisma.drawWinner.groupBy({
        by: ['status'],
        where: { isAlternate: false },
        _count: { id: true },
      });

      const totalWinners = winners.reduce((sum, w) => sum + w._count.id, 0);

      ApiResponseHelper.success(res, {
        summary: {
          totalWinners,
          byStatus: winners.map((w) => ({
            status: w.status,
            count: w._count.id,
            percentage: ((w._count.id / totalWinners) * 100).toFixed(2) + '%',
          })),
        },
      });
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to generate report', 500);
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
      const { page = 1, limit = 50, entityType, entityId, performedBy } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (performedBy) where.performedBy = performedBy;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      ApiResponseHelper.paginated(res, logs, total, page, limit);
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to fetch audit logs', 500);
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
      const { page = 1, limit = 20, role } = req.query as any;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (role) where.role = role;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      ApiResponseHelper.paginated(res, users, total, page, limit);
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to fetch users', 500);
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

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      ApiResponseHelper.success(res, user, 'User role updated');
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to update user role', 500);
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

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      ApiResponseHelper.success(res, user, `User ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      ApiResponseHelper.error(res, 'Failed to update user status', 500);
    }
  }
);

export default router;
