import prisma from '../config/database';
import { DrawEngine } from './drawEngine';
import { AppError } from '../utils/appError';
import { messageQueue } from './messageQueue';

interface ExecuteDrawInput {
  campaignId: string;
  numberOfWinners?: number;
  numberOfAlternates?: number;
}

interface DrawQuery {
  page?: number;
  limit?: number;
}

export class DrawService {
  async executeDraw(data: ExecuteDrawInput, userId: string) {
    const { campaignId, numberOfWinners = 1, numberOfAlternates = 3 } = data;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const drawEngine = new DrawEngine();
    const result = await drawEngine.executeDraw({
      campaignId,
      numberOfWinners,
      numberOfAlternates,
      allowMultipleWins: false,
    });

    await prisma.drawResult.update({
      where: { id: result.drawId },
      data: {
        executedBy: [userId],
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'DRAW',
        entityId: result.drawId,
        action: 'EXECUTED',
        performedBy: userId,
        details: {
          campaignId,
          totalWinners: result.winners.length,
          totalAlternates: result.alternates.length,
        },
      },
    });

    // Queue winner announcements (best-effort, must not fail the draw execution)
    try {
      const winnerRecords = await prisma.drawWinner.findMany({
        where: { drawResultId: result.drawId, isAlternate: false },
        include: { prize: { select: { name: true } } },
      });

      for (const winner of winnerRecords) {
        await messageQueue.publish('notifications', 'WINNER_ANNOUNCEMENT', {
          customerId: winner.customerId,
          campaignId,
          campaignName: campaign.name,
          prizeName: winner.prize.name,
        });
      }
    } catch (error) {
      console.error('Failed to queue winner announcements:', error);
    }

    return result;
  }

  async list(query: DrawQuery) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [draws, total] = await Promise.all([
      prisma.drawResult.findMany({
        skip,
        take: limit,
        orderBy: { drawDate: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
          winners: {
            where: { isAlternate: false },
            include: { prize: true },
          },
          _count: { select: { winners: true } },
        },
      }),
      prisma.drawResult.count(),
    ]);

    return { data: draws, total, page, limit };
  }

  async getById(id: string) {
    const draw = await prisma.drawResult.findUnique({
      where: { id },
      include: {
        campaign: { select: { id: true, name: true, drawDate: true } },
        winners: {
          include: { prize: true },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!draw) {
      throw new AppError('Draw not found', 404);
    }

    return draw;
  }

  async addWitness(id: string, userId: string) {
    const draw = await prisma.drawResult.findUnique({ where: { id } });

    if (!draw) {
      throw new AppError('Draw not found', 404);
    }

    if (draw.witnessedBy.includes(userId)) {
      throw new AppError('Already a witness', 400);
    }

    const updated = await prisma.drawResult.update({
      where: { id },
      data: {
        witnessedBy: [...draw.witnessedBy, userId],
      },
    });

    return updated;
  }

  async verifyDraw(id: string, userId: string) {
    const draw = await prisma.drawResult.findUnique({ where: { id } });

    if (!draw) {
      throw new AppError('Draw not found', 404);
    }

    const drawEngine = new DrawEngine();
    const isValid = await drawEngine.verifyDraw(id);

    const updated = await prisma.drawResult.update({
      where: { id },
      data: {
        isVerified: isValid,
        verifiedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'DRAW',
        entityId: id,
        action: 'VERIFIED',
        performedBy: userId,
        details: { isValid },
      },
    });

    return { draw: updated, isValid };
  }

  async getCampaignDraws(campaignId: string) {
    const draws = await prisma.drawResult.findMany({
      where: { campaignId },
      orderBy: { drawDate: 'desc' },
      include: {
        winners: {
          where: { isAlternate: false },
          include: { prize: true },
        },
        _count: { select: { winners: true } },
      },
    });

    return draws;
  }
}

export const drawService = new DrawService();
