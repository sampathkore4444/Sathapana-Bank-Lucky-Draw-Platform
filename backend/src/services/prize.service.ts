import prisma from '../config/database';
import { PrizeCategory } from '@prisma/client';
import { AppError } from '../utils/appError';

interface CreatePrizeInput {
  campaignId: string;
  rank: number;
  name: string;
  category: PrizeCategory;
  description?: string;
  quantity: number;
  estimatedValue: number;
  currency?: string;
  vendorName?: string;
  vendorContact?: Record<string, any>;
  fulfillmentInstructions?: string;
  alternativesOffered?: any[];
  termsAndConditions?: string;
}

interface UpdatePrizeInput {
  rank?: number;
  name?: string;
  category?: PrizeCategory;
  description?: string;
  quantity?: number;
  estimatedValue?: number;
  currency?: string;
  vendorName?: string;
  vendorContact?: Record<string, any>;
  fulfillmentInstructions?: string;
  alternativesOffered?: any[];
  termsAndConditions?: string;
}

interface PrizeQuery {
  page?: number;
  limit?: number;
  campaignId?: string;
}

export class PrizeService {
  async list(query: PrizeQuery) {
    const { page = 1, limit = 20, campaignId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (campaignId) where.campaignId = campaignId;

    const [prizes, total] = await Promise.all([
      prisma.prize.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ campaignId: 'asc' }, { rank: 'asc' }],
        include: {
          campaign: { select: { id: true, name: true } },
          _count: { select: { winners: true } },
        },
      }),
      prisma.prize.count({ where }),
    ]);

    return { data: prizes, total, page, limit };
  }

  async getById(id: string) {
    const prize = await prisma.prize.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true } },
        winners: {
          select: {
            id: true,
            customerId: true,
            status: true,
            verifiedAt: true,
            fulfilledAt: true,
          },
        },
      },
    });

    if (!prize) {
      throw new AppError('Prize not found', 404);
    }

    return prize;
  }

  async create(data: CreatePrizeInput) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const prize = await prisma.prize.create({
      data: {
        campaignId: data.campaignId,
        rank: data.rank,
        name: data.name,
        category: data.category,
        description: data.description,
        quantity: data.quantity,
        estimatedValue: data.estimatedValue,
        currency: data.currency || 'USD',
        vendorName: data.vendorName,
        vendorContact: data.vendorContact || {},
        fulfillmentInstructions: data.fulfillmentInstructions,
        alternativesOffered: data.alternativesOffered || [],
        termsAndConditions: data.termsAndConditions,
      },
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });

    return prize;
  }

  async update(id: string, data: UpdatePrizeInput) {
    const prize = await prisma.prize.findUnique({ where: { id } });

    if (!prize) {
      throw new AppError('Prize not found', 404);
    }

    const updated = await prisma.prize.update({
      where: { id },
      data,
      include: {
        campaign: { select: { id: true, name: true } },
      },
    });

    return updated;
  }

  async delete(id: string) {
    const prize = await prisma.prize.findUnique({
      where: { id },
      include: { _count: { select: { winners: true } } },
    });

    if (!prize) {
      throw new AppError('Prize not found', 404);
    }

    if (prize._count.winners > 0) {
      throw new AppError('Cannot delete prize with assigned winners', 400);
    }

    await prisma.prize.delete({ where: { id } });
  }

  async getCampaignPrizes(campaignId: string) {
    const prizes = await prisma.prize.findMany({
      where: { campaignId },
      orderBy: { rank: 'asc' },
      include: {
        _count: { select: { winners: true } },
      },
    });

    return prizes;
  }
}

export const prizeService = new PrizeService();
