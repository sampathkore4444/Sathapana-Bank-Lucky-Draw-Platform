import prisma from '../config/database';
import { AppError } from '../utils/appError';
import { entryService } from './entry.service';
import { winnerService } from './winner.service';
import notificationService from './notification';
import { coreBankingService } from './coreBanking.service';
import { generateCustomerToken } from '../middleware/auth';

interface CustomerQuery {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}

export class CustomerService {
  /**
   * Customer authentication against the core banking system.
   * Issues a short-lived JWT scoped to a single customer.
   */
  async login(customerId: string) {
    const customer = await coreBankingService.verifyCustomer(customerId);

    if (!customer || customer.isActive === false) {
      throw new AppError('Invalid customer credentials', 401);
    }

    const token = generateCustomerToken(customerId);

    return {
      token,
      customerId,
      name: customer.name,
    };
  }

  /**
   * Customer dashboard: running campaigns, total entries, wins and unread notifications.
   */
  async getDashboard(customerId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'DRAW_DAY', 'DRAWN', 'CLOSED'] } },
      include: {
        entries: {
          where: { customerId },
          select: { entriesEarned: true, entryDate: true },
        },
      },
    });

    const participating = campaigns.filter((c) => c.entries.length > 0);
    const summary = participating.map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      campaignStatus: c.status,
      totalEntries: c.entries.reduce((sum, e) => sum + e.entriesEarned, 0),
      lastEntryDate: c.entries[0]?.entryDate,
      drawDate: c.drawDate,
    }));

    const [wins, unreadNotifications] = await Promise.all([
      prisma.drawWinner.count({
        where: { customerId, isAlternate: false, status: { notIn: ['DECLINED', 'EXPIRED'] } },
      }),
      prisma.notification.count({
        where: { customerId, status: { not: 'READ' } },
      }),
    ]);

    return {
      customerId,
      campaigns: summary,
      totalEntries: summary.reduce((sum, s) => sum + s.totalEntries, 0),
      activeCampaigns: summary.filter((s) => s.campaignStatus === 'ACTIVE').length,
      totalWins: wins,
      unreadNotifications,
    };
  }

  /**
   * Public campaign catalogue for bank customers.
   */
  async listCampaigns(query: CustomerQuery) {
    const { page = 1, limit = 10, status, type } = query;
    const skip = (page - 1) * limit;

    const where: any = { status: { in: ['SCHEDULED', 'ACTIVE', 'DRAW_DAY'] } };
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          drawDate: true,
          termsAndConditions: true,
          prizes: { select: { id: true, rank: true, name: true, category: true, quantity: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { data: campaigns, total, page, limit };
  }

  /**
   * Check whether a customer qualifies for a campaign.
   */
  async checkEligibility(customerId: string, campaignId: string) {
    return entryService.checkEligibility(customerId, campaignId);
  }

  /**
   * Customer's own entry history.
   */
  async getEntries(customerId: string, query: CustomerQuery) {
    return entryService.getCustomerEntries(customerId, query);
  }

  /**
   * Customer's own wins.
   */
  async getWins(customerId: string) {
    return winnerService.getCustomerWins(customerId);
  }

  /**
   * Customer's notifications inbox.
   */
  async getNotifications(customerId: string, query: CustomerQuery) {
    const { page = 1, limit = 20 } = query;
    return notificationService.getCustomerNotifications(customerId, page, limit);
  }

  /**
   * Mark a notification as read.
   */
  async markNotificationRead(notificationId: string, customerId: string): Promise<void> {
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, customerId },
      data: { status: 'READ', readAt: new Date() },
    });

    if (updated.count === 0) {
      throw new AppError('Notification not found', 404);
    }
  }
}

export const customerService = new CustomerService();