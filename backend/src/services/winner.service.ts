import prisma from '../config/database';
import { AppError } from '../utils/appError';

const VALID_TRANSITIONS: Record<string, string[]> = {
  SELECTED: ['VERIFIED', 'DECLINED'],
  VERIFIED: ['CONTACTED', 'DECLINED'],
  CONTACTED: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['FULFILLED'],
  DECLINED: [],
  FULFILLED: [],
  EXPIRED: [],
};

interface WinnerQuery {
  page?: number;
  limit?: number;
  status?: string;
  campaignId?: string;
}

interface UpdateWinnerStatusInput {
  status: string;
  notes?: string;
}

export class WinnerService {
  async list(query: WinnerQuery) {
    const { page = 1, limit = 20, status, campaignId } = query;
    const skip = (page - 1) * limit;

    const where: any = { isAlternate: false };
    if (status) where.status = status;
    if (campaignId) {
      where.drawResult = { campaignId };
    }

    const [winners, total] = await Promise.all([
      prisma.drawWinner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prize: true,
          drawResult: {
            include: { campaign: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.drawWinner.count({ where }),
    ]);

    return { data: winners, total, page, limit };
  }

  async getById(id: string) {
    const winner = await prisma.drawWinner.findUnique({
      where: { id },
      include: {
        prize: true,
        drawResult: {
          include: {
            campaign: { select: { id: true, name: true, drawDate: true } },
          },
        },
      },
    });

    if (!winner) {
      throw new AppError('Winner not found', 404);
    }

    return winner;
  }

  async updateStatus(id: string, data: UpdateWinnerStatusInput, userId: string) {
    const winner = await prisma.drawWinner.findUnique({ where: { id } });

    if (!winner) {
      throw new AppError('Winner not found', 404);
    }

    if (!VALID_TRANSITIONS[winner.status]?.includes(data.status)) {
      throw new AppError(
        `Cannot transition from ${winner.status} to ${data.status}`,
        400
      );
    }

    const updateData: any = { status: data.status, notes: data.notes };
    if (data.status === 'VERIFIED') updateData.verifiedAt = new Date();
    if (data.status === 'CONTACTED') updateData.contactedAt = new Date();
    if (data.status === 'ACCEPTED') updateData.acceptedAt = new Date();
    if (data.status === 'FULFILLED') updateData.fulfilledAt = new Date();

    const updated = await prisma.drawWinner.update({
      where: { id },
      data: updateData,
      include: {
        prize: true,
        drawResult: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'WINNER',
        entityId: id,
        action: `STATUS_CHANGED_TO_${data.status}`,
        performedBy: userId,
        details: { previousStatus: winner.status, newStatus: data.status },
      },
    });

    return updated;
  }

  async getCampaignWinners(campaignId: string) {
    const winners = await prisma.drawWinner.findMany({
      where: {
        isAlternate: false,
        drawResult: { campaignId },
      },
      orderBy: { rank: 'asc' },
      include: {
        prize: true,
        drawResult: { select: { drawDate: true } },
      },
    });

    return winners;
  }

  async getCustomerWins(customerId: string) {
    const wins = await prisma.drawWinner.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        prize: true,
        drawResult: {
          include: {
            campaign: { select: { id: true, name: true, drawDate: true } },
          },
        },
      },
    });

    return wins;
  }

  async promoteAlternate(id: string) {
    const winner = await prisma.drawWinner.findUnique({ where: { id } });

    if (!winner) {
      throw new AppError('Winner not found', 404);
    }

    if (!winner.isAlternate) {
      throw new AppError('Can only promote alternates', 400);
    }

    const originalWinner = await prisma.drawWinner.findFirst({
      where: {
        drawResultId: winner.drawResultId,
        prizeId: winner.prizeId,
        isAlternate: false,
        status: { in: ['DECLINED', 'EXPIRED'] },
      },
    });

    if (!originalWinner) {
      throw new AppError('No declined winner to replace', 400);
    }

    const updated = await prisma.drawWinner.update({
      where: { id },
      data: {
        isAlternate: false,
        rank: originalWinner.rank,
        status: 'SELECTED',
      },
      include: {
        prize: true,
        drawResult: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
    });

    return updated;
  }
}

export const winnerService = new WinnerService();
