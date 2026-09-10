import prisma from '../config/database';
import { EntryType } from '@prisma/client';
import { AppError } from '../utils/appError';
import { EntryQuery } from '../types';
import { messageQueue } from './messageQueue';

interface RegisterEntryInput {
  customerId: string;
  campaignId: string;
  accountId?: string;
  entryType: EntryType;
  triggerTransactionId?: string;
  metadata?: Record<string, any>;
}

export class EntryService {
  async register(data: RegisterEntryInput, userId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'ACTIVE' && campaign.status !== 'DRAW_DAY') {
      throw new AppError('Campaign is not active', 400);
    }

    const now = new Date();
    if (now < campaign.startDate || now > campaign.endDate) {
      throw new AppError('Campaign is not within active dates', 400);
    }

    if (data.triggerTransactionId) {
      const existingEntry = await prisma.customerEntry.findUnique({
        where: {
          campaignId_customerId_triggerTransactionId: {
            campaignId: data.campaignId,
            customerId: data.customerId,
            triggerTransactionId: data.triggerTransactionId,
          },
        },
      });

      if (existingEntry) {
        throw new AppError('Entry already registered for this transaction', 409);
      }
    }

    const previousEntries = await prisma.customerEntry.aggregate({
      where: { campaignId: data.campaignId, customerId: data.customerId },
      _sum: { entriesEarned: true },
    });

    const currentCumulative = previousEntries._sum.entriesEarned || 0;

    const entryRules = campaign.entryRules as any[];
    let entriesEarned = 1;

    const matchingRule = entryRules.find((rule) => rule.trigger === data.entryType);
    if (matchingRule) {
      entriesEarned = matchingRule.entriesPerAction || matchingRule.entriesPerIncrement || 1;
    }

    const newEntry = await prisma.customerEntry.create({
      data: {
        customerId: data.customerId,
        campaignId: data.campaignId,
        accountId: data.accountId,
        entryType: data.entryType,
        entriesEarned,
        cumulativeEntries: currentCumulative + entriesEarned,
        triggerTransactionId: data.triggerTransactionId,
        verified: true,
        verificationSource: 'SYSTEM',
        metadata: data.metadata || {},
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'ENTRY',
        entityId: newEntry.id,
        action: 'CREATED',
        performedBy: userId,
        details: { customerId: data.customerId, campaignId: data.campaignId, entriesEarned },
      },
    });

    // Queue entry confirmation notification (best-effort, must not fail the registration)
    try {
      await messageQueue.publish('notifications', 'ENTRY_CONFIRMATION', {
        customerId: data.customerId,
        campaignId: data.campaignId,
        entriesEarned,
        totalEntries: newEntry.cumulativeEntries,
      });
    } catch (error) {
      console.error('Failed to queue entry confirmation:', error);
    }

    return { entry: newEntry, entriesEarned };
  }

  async list(query: EntryQuery) {
    const { page = 1, limit = 50, customerId, campaignId, verified } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (campaignId) where.campaignId = campaignId;
    if (verified !== undefined) where.verified = verified;

    const [entries, total] = await Promise.all([
      prisma.customerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
      }),
      prisma.customerEntry.count({ where }),
    ]);

    return { data: entries, total, page, limit };
  }

  async getCustomerEntries(customerId: string, query: EntryQuery) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      prisma.customerEntry.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { entryDate: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
        },
      }),
      prisma.customerEntry.count({ where: { customerId } }),
    ]);

    return { data: entries, total, page, limit };
  }

  async getCustomerSummary(customerId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'DRAW_DAY', 'DRAWN', 'CLOSED'] } },
      include: {
        entries: {
          where: { customerId },
          select: { entriesEarned: true, entryDate: true },
        },
        _count: { select: { entries: true } },
      },
    });

    const summary = campaigns
      .filter((c) => c.entries.length > 0)
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        campaignStatus: c.status,
        totalEntries: c.entries.reduce((sum, e) => sum + e.entriesEarned, 0),
        lastEntryDate: c.entries[0]?.entryDate,
        totalParticipants: c._count.entries,
      }));

    return { customerId, campaigns: summary };
  }

  async checkEligibility(customerId: string, campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        entries: {
          where: { customerId },
          select: { entriesEarned: true, entryDate: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const totalEntries = campaign.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
    const eligibilityCriteria = campaign.eligibilityCriteria as any;
    const maxEntries = eligibilityCriteria?.maxEntriesPerCustomer || 50;

    return {
      customerId,
      campaignId,
      eligible: campaign.status === 'ACTIVE' && totalEntries < maxEntries,
      currentEntries: totalEntries,
      maxEntries,
      campaignStatus: campaign.status,
    };
  }
}

export const entryService = new EntryService();
