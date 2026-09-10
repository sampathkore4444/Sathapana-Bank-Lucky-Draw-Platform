import prisma from '../config/database';
import { AppError } from '../utils/appError';

interface ClaimQuery {
  page?: number;
  limit?: number;
  status?: string;
}

interface DocumentInput {
  type: string;
  filePath: string;
  mimeType: string;
  size: number;
  notes?: string;
}

export class ClaimService {
  /**
   * Winner (or a bank coordinator on their behalf) opens a prize claim.
   * Pass `customerId` to enforce ownership; pass `null` for staff-assisted claims.
   */
  async createClaim(winnerId: string, customerId?: string) {
    const winner = await prisma.drawWinner.findUnique({
      where: { id: winnerId },
      include: { claim: true },
    });

    if (!winner) {
      throw new AppError('Winner not found', 404);
    }

    if (winner.isAlternate) {
      throw new AppError('Alternates cannot submit claims', 400);
    }

    if (customerId && winner.customerId !== customerId) {
      throw new AppError('This claim does not belong to the customer', 403);
    }

    if (!['SELECTED', 'VERIFIED', 'CONTACTED', 'ACCEPTED'].includes(winner.status)) {
      throw new AppError('Winner is not in a claimable state', 400);
    }

    if (winner.claim) {
      throw new AppError('A claim already exists for this winner', 409);
    }

    return prisma.prizeClaim.create({
      data: {
        winnerId,
        status: 'SUBMITTED',
        claimedAt: new Date(),
      },
      include: {
        winner: {
          include: {
            prize: true,
            drawResult: { include: { campaign: { select: { name: true } } } },
          },
        },
      },
    });
  }

  /**
   * List claims (admin).
   */
  async listClaims(query: ClaimQuery) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.prizeClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          winner: {
            include: {
              prize: true,
              drawResult: { include: { campaign: { select: { id: true, name: true } } } },
            },
          },
          documents: true,
        },
      }),
      prisma.prizeClaim.count({ where }),
    ]);

    return { data: claims, total, page, limit };
  }

  /**
   * Get a single claim.
   */
  async getClaim(id: string) {
    const claim = await prisma.prizeClaim.findUnique({
      where: { id },
      include: {
        winner: {
          include: {
            prize: true,
            drawResult: {
              include: { campaign: { select: { id: true, name: true, drawDate: true } } },
            },
          },
        },
        documents: true,
      },
    });

    if (!claim) {
      throw new AppError('Claim not found', 404);
    }

    return claim;
  }

  /**
   * Attach a document to a claim.
   */
  async addDocument(claimId: string, data: DocumentInput) {
    const claim = await prisma.prizeClaim.findUnique({ where: { id: claimId } });

    if (!claim) {
      throw new AppError('Claim not found', 404);
    }

    return prisma.document.create({
      data: {
        claimId,
        winnerId: claim.winnerId,
        type: data.type as any,
        filePath: data.filePath,
        mimeType: data.mimeType,
        size: data.size,
        notes: data.notes,
        status: 'PENDING',
      },
    });
  }

  /**
   * Verify or reject a submitted document.
   */
  async verifyDocument(id: string, status: 'VERIFIED' | 'REJECTED', notes?: string) {
    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw new AppError('Document not found', 404);
    }

    return prisma.document.update({
      where: { id },
      data: {
        status,
        notes,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
    });
  }

  /**
   * Review a claim (approve or reject).
   */
  async reviewClaim(id: string, status: 'APPROVED' | 'REJECTED', decisionNote: string | undefined, userId: string) {
    const claim = await prisma.prizeClaim.findUnique({ where: { id }, include: { winner: true } });
    if (!claim) {
      throw new AppError('Claim not found', 404);
    }

    if (claim.status === 'FULFILLED') {
      throw new AppError('Claim already fulfilled', 400);
    }

    const updated = await prisma.prizeClaim.update({
      where: { id },
      data: {
        status,
        reviewedBy: userId,
        reviewedAt: new Date(),
        decisionNote,
      },
    });

    // Approval of the claim confirms the winner's acceptance
    if (status === 'APPROVED') {
      await prisma.drawWinner.update({
        where: { id: claim.winnerId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        entityType: 'CLAIM',
        entityId: id,
        action: `CLAIM_${status}`,
        performedBy: userId,
        details: { winnerId: claim.winnerId, decisionNote },
      },
    });

    return updated;
  }

  /**
   * Mark a prize as fulfilled once delivery is complete.
   */
  async fulfillClaim(id: string, userId: string) {
    const claim = await prisma.prizeClaim.findUnique({ where: { id }, include: { winner: true } });
    if (!claim) {
      throw new AppError('Claim not found', 404);
    }

    if (claim.status !== 'APPROVED') {
      throw new AppError('Claim must be approved before fulfillment', 400);
    }

    const updated = await prisma.prizeClaim.update({
      where: { id },
      data: { status: 'FULFILLED' },
    });

    await prisma.drawWinner.update({
      where: { id: claim.winnerId },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    await prisma.prize.update({
      where: { id: claim.winner.prizeId },
      data: { fulfilled: { increment: 1 } },
    });

    await prisma.auditLog.create({
      data: {
        entityType: 'CLAIM',
        entityId: id,
        action: 'CLAIM_FULFILLED',
        performedBy: userId,
        details: { winnerId: claim.winnerId },
      },
    });

    return updated;
  }

  /**
   * Public winner list (no personal data) for a campaign.
   */
  async getPublicWinners(campaignId: string) {
    const winners = await prisma.drawWinner.findMany({
      where: {
        isAlternate: false,
        status: { in: ['ACCEPTED', 'FULFILLED'] },
        drawResult: { campaignId },
      },
      orderBy: { rank: 'asc' },
      include: {
        prize: { select: { rank: true, name: true, category: true } },
        drawResult: { select: { drawDate: true, auditHash: true } },
      },
    });

    return winners.map((w) => ({
      winnerId: w.id,
      rank: w.rank,
      prize: w.prize,
      drawDate: w.drawResult.drawDate,
      auditHash: w.drawResult.auditHash,
      // Mask the customer identifier for public display
      customerCode: this.maskCustomerId(w.customerId),
    }));
  }

  private maskCustomerId(customerId: string): string {
    if (customerId.length <= 4) return '****';
    return `${customerId.slice(0, 3)}****${customerId.slice(-2)}`;
  }
}

export const claimService = new ClaimService();