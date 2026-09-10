import prisma from '../config/database';
import { CampaignType } from '@prisma/client';
import { AppError } from '../utils/appError';
import { CampaignQuery } from '../types';

interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  startDate: string;
  endDate: string;
  drawDate: string;
  eligibilityCriteria?: any;
  entryRules?: any[];
  drawSettings?: any;
  termsAndConditions?: string;
  notificationSettings?: any;
}

interface UpdateCampaignInput {
  name?: string;
  description?: string;
  type?: CampaignType;
  startDate?: string;
  endDate?: string;
  drawDate?: string;
  eligibilityCriteria?: any;
  entryRules?: any[];
  drawSettings?: any;
  termsAndConditions?: string;
  notificationSettings?: any;
}

export class CampaignService {
  async list(query: CampaignQuery) {
    const { page = 1, limit = 10, status, type } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { entries: true, prizes: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return { data: campaigns, total, page, limit };
  }

  async getById(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        prizes: { orderBy: { rank: 'asc' } },
        _count: { select: { entries: true, drawResults: true } },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    return campaign;
  }

  async create(data: CreateCampaignInput, userId: string) {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        drawDate: new Date(data.drawDate),
        eligibilityCriteria: data.eligibilityCriteria || {},
        entryRules: data.entryRules || [],
        drawSettings: data.drawSettings || {},
        termsAndConditions: data.termsAndConditions,
        notificationSettings: data.notificationSettings || {},
        createdBy: userId,
      },
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'CREATED',
        performedBy: userId,
        details: { campaignName: data.name },
      },
    });

    return campaign;
  }

  async update(id: string, data: UpdateCampaignInput, userId: string) {
    const existing = await prisma.campaign.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED'].includes(existing.status)) {
      throw new AppError('Cannot update campaign in current status', 400);
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        drawDate: data.drawDate ? new Date(data.drawDate) : undefined,
        updatedBy: userId,
      },
      include: {
        _count: { select: { entries: true, prizes: true } },
      },
    });

    return campaign;
  }

  async delete(id: string) {
    const existing = await prisma.campaign.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError('Campaign not found', 404);
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError('Can only delete draft campaigns', 400);
    }

    await prisma.campaign.delete({ where: { id } });
  }

  async activate(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
      throw new AppError('Cannot activate campaign in current status', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CAMPAIGN',
        entityId: campaign.id,
        action: 'ACTIVATED',
        performedBy: userId,
        details: { previousStatus: campaign.status },
      },
    });

    return updated;
  }

  async pause(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'ACTIVE') {
      throw new AppError('Can only pause active campaigns', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'SCHEDULED', updatedBy: userId },
    });

    return updated;
  }

  async close(id: string, userId: string) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: 'CLOSED', updatedBy: userId },
    });

    return updated;
  }

  async getStats(id: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { entries: true, prizes: true, drawResults: true } },
        entries: {
          select: { entriesEarned: true, verified: true, entryType: true, customerId: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const totalEntries = campaign.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
    const uniqueParticipants = new Set(campaign.entries.map((e) => e.customerId)).size;
    const verifiedEntries = campaign.entries.filter((e) => e.verified).length;

    const entryTypeBreakdown = campaign.entries.reduce((acc, e) => {
      acc[e.entryType] = (acc[e.entryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      totalEntries,
      uniqueParticipants,
      verifiedEntries,
      unverifiedEntries: campaign.entries.length - verifiedEntries,
      totalPrizes: campaign._count.prizes,
      totalDraws: campaign._count.drawResults,
      entryTypeBreakdown,
    };
  }
}

export const campaignService = new CampaignService();
