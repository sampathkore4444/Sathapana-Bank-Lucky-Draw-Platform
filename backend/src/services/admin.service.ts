import prisma from '../config/database';
import { UserRole } from '@prisma/client';

interface AuditLogQuery {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  performedBy?: string;
}

interface UserQuery {
  page?: number;
  limit?: number;
  role?: string;
}

export class AdminService {
  async getDashboard() {
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

    const campaignsByStatus = await prisma.campaign.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return {
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
    };
  }

  async getCampaignPerformanceReport() {
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

    return report;
  }

  async getWinnerFulfillmentReport() {
    const winners = await prisma.drawWinner.groupBy({
      by: ['status'],
      where: { isAlternate: false },
      _count: { id: true },
    });

    const totalWinners = winners.reduce((sum, w) => sum + w._count.id, 0);

    return {
      summary: {
        totalWinners,
        byStatus: winners.map((w) => ({
          status: w.status,
          count: w._count.id,
          percentage: ((w._count.id / totalWinners) * 100).toFixed(2) + '%',
        })),
      },
    };
  }

  async getAuditLogs(query: AuditLogQuery) {
    const { page = 1, limit = 50, entityType, entityId, performedBy } = query;
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

    return { data: logs, total, page, limit };
  }

  async getUsers(query: UserQuery) {
    const { page = 1, limit = 20, role } = query;
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

    return { data: users, total, page, limit };
  }

  async updateUserRole(id: string, role: UserRole) {
    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return user;
  }

  async updateUserStatus(id: string, isActive: boolean) {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    return user;
  }
}

export const adminService = new AdminService();
