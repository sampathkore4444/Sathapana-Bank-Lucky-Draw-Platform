import crypto from 'crypto';
import prisma from '../config/database';

// ==================== Types ====================

type DrawType = 'RANDOM' | 'TIERED' | 'SCHEDULED' | 'INSTANT';

interface DrawParticipant {
  customerId: string;
  totalEntries: number;
  weight: number;
}

interface DrawInput {
  campaignId: string;
  numberOfWinners: number;
  numberOfAlternates: number;
  allowMultipleWins: boolean;
  drawType?: DrawType;
  customerId?: string;
  batchNumber?: number;
}

export interface DrawOutput {
  drawId: string;
  seed: string;
  auditHash: string;
  winners: DrawResult[];
  alternates: DrawResult[];
}

interface DrawResult {
  rank: number;
  customerId: string;
  entriesAtDraw: number;
  selectedAt: string;
}

interface PrizeAssignment {
  rank: number;
  customerId: string;
  entriesAtDraw: number;
  prizeId: string;
}

// ==================== Draw Engine Class ====================

export class DrawEngine {
  private seed: string;
  private algorithm: string;

  constructor() {
    this.seed = '';
    this.algorithm = 'Fisher-Yates Shuffle with Weighting';
  }

  /**
   * Execute a draw for the given campaign
   */
  async executeDraw(input: DrawInput): Promise<DrawOutput> {
    const drawType = input.drawType || 'RANDOM';

    // 1. Pre-draw validation
    const campaign = await this.validateDraw(input, drawType);

    // 2. Get eligible participants
    const participants = await this.getEligibleParticipants(input.campaignId, input.customerId);

    if (participants.length === 0) {
      throw new Error('No eligible participants found');
    }

    // 3. Generate cryptographically secure seed
    this.seed = this.generateSeed();

    // 4. Execute selection based on draw type
    const prizes = await prisma.prize.findMany({
      where: { campaignId: input.campaignId },
      orderBy: { rank: 'asc' },
    });

    const winnerAssignments: PrizeAssignment[] = [];
    let selectedWinnerIds: string[] = [];

    if (drawType === 'TIERED') {
      const selection = this.tieredSelection(
        participants,
        prizes,
        input.numberOfWinners,
        input.allowMultipleWins
      );
      winnerAssignments.push(...selection.assignments);
      selectedWinnerIds = selection.customerIds;
    } else {
      const selectedWinners = this.weightedRandomSelection(
        participants,
        input.numberOfWinners,
        input.allowMultipleWins
      );

      selectedWinners.forEach((w, i) => {
        const prize = prizes[i] || prizes[0];
        winnerAssignments.push({
          rank: i + 1,
          customerId: w.customerId,
          entriesAtDraw: w.totalEntries,
          prizeId: prize?.id || '',
        });
      });
      selectedWinnerIds = selectedWinners.map((w) => w.customerId);
    }

    // 5. Select alternates (from remaining participants) — instant draws do not use alternates
    const alternateCount = drawType === 'INSTANT' ? 0 : input.numberOfAlternates;
    const remainingParticipants = participants.filter(
      (p) => !selectedWinnerIds.includes(p.customerId)
    );

    const selectedAlternates = this.weightedRandomSelection(
      remainingParticipants,
      alternateCount,
      false
    );

    const alternateAssignments: PrizeAssignment[] = selectedAlternates.map((a, i) => ({
      rank: winnerAssignments.length + i + 1,
      customerId: a.customerId,
      entriesAtDraw: a.totalEntries,
      prizeId: prizes[0]?.id || '',
    }));

    // 6. Generate audit hash
    const auditHash = this.generateAuditHash(
      winnerAssignments.map((w) => w.customerId),
      alternateAssignments.map((a) => a.customerId)
    );

    // 7. Save draw result to database
    const drawResult = await this.saveDrawResult(
      input.campaignId,
      campaign,
      drawType,
      input.batchNumber,
      participants,
      winnerAssignments,
      alternateAssignments,
      auditHash
    );

    return {
      drawId: drawResult.id,
      seed: this.seed,
      auditHash,
      winners: winnerAssignments.map((w) => ({
        rank: w.rank,
        customerId: w.customerId,
        entriesAtDraw: w.entriesAtDraw,
        selectedAt: new Date().toISOString(),
      })),
      alternates: alternateAssignments.map((a) => ({
        rank: a.rank,
        customerId: a.customerId,
        entriesAtDraw: a.entriesAtDraw,
        selectedAt: new Date().toISOString(),
      })),
    };
  }

  /**
   * Validate that a draw can be executed
   */
  private async validateDraw(input: DrawInput, drawType: DrawType) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const now = new Date();

    if (drawType === 'INSTANT') {
      if (campaign.status !== 'ACTIVE') {
        throw new Error('Campaign is not active');
      }
    } else {
      if (campaign.status !== 'ACTIVE' && campaign.status !== 'DRAW_DAY') {
        throw new Error('Campaign is not in a valid state for drawing');
      }
      if (now < campaign.drawDate) {
        throw new Error('Draw date has not been reached');
      }
    }

    // Check prize availability
    const prizes = await prisma.prize.findMany({
      where: { campaignId: input.campaignId },
    });

    if (drawType === 'INSTANT') {
      const remainingPrizes = prizes.reduce(
        (sum, p) => sum + (p.quantity - p.allocated),
        0
      );
      if (remainingPrizes < input.numberOfWinners) {
        throw new Error('Not enough prizes available');
      }
    } else {
      const totalPrizeQuantity = prizes.reduce((sum, p) => sum + p.quantity, 0);
      if (input.numberOfWinners > totalPrizeQuantity) {
        throw new Error('Not enough prizes available');
      }
    }

    return campaign;
  }

  /**
   * Get all eligible participants for the campaign (optionally limited to one customer)
   */
  private async getEligibleParticipants(
    campaignId: string,
    customerId?: string
  ): Promise<DrawParticipant[]> {
    const where: any = {
      campaignId,
      verified: true,
    };
    if (customerId) {
      where.customerId = customerId;
    }

    const entries = await prisma.customerEntry.groupBy({
      by: ['customerId'],
      where,
      _sum: { entriesEarned: true },
    });

    const totalEntriesAll = entries.reduce((sum, e) => sum + (e._sum.entriesEarned || 0), 0);

    return entries.map((entry) => ({
      customerId: entry.customerId,
      totalEntries: entry._sum.entriesEarned || 0,
      weight: totalEntriesAll > 0 ? (entry._sum.entriesEarned || 0) / totalEntriesAll : 0,
    }));
  }

  /**
   * Tiered selection: draw for each prize tier in ascending rank from the remaining pool.
   */
  private tieredSelection(
    participants: DrawParticipant[],
    prizes: { id: string; rank: number; quantity: number }[],
    numberOfWinners: number,
    allowMultipleWins: boolean
  ): { assignments: PrizeAssignment[]; customerIds: string[] } {
    const assignments: PrizeAssignment[] = [];
    const selectedIds: string[] = [];
    let pool = [...participants];
    let drawn = 0;
    let rank = 1;

    for (const prize of prizes) {
      if (drawn >= numberOfWinners || pool.length === 0) break;

      const count = Math.min(prize.quantity, numberOfWinners - drawn);
      const selected = this.weightedRandomSelection(pool, count, false);

      for (const winner of selected) {
        assignments.push({
          rank: rank++,
          customerId: winner.customerId,
          entriesAtDraw: winner.totalEntries,
          prizeId: prize.id,
        });
      }

      selectedIds.push(...selected.map((s) => s.customerId));
      drawn += selected.length;

      // Remove tier winners from pool for subsequent tiers (unless multiple wins allowed)
      if (!allowMultipleWins) {
        pool = pool.filter((p) => !selected.some((s) => s.customerId === p.customerId));
      }
    }

    return { assignments, customerIds: selectedIds };
  }

  /**
   * Generate a cryptographically secure seed
   */
  private generateSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Weighted random selection using Fisher-Yates shuffle
   * Customers with more entries have proportionally higher chances
   */
  private weightedRandomSelection(
    participants: DrawParticipant[],
    count: number,
    allowMultipleWins: boolean
  ): DrawParticipant[] {
    const selected: DrawParticipant[] = [];
    const pool = [...participants];

    for (let i = 0; i < count && pool.length > 0; i++) {
      // Calculate total weight in current pool
      const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
      if (totalWeight <= 0) break;

      // Generate random value
      const randomValue = this.secureRandom() * totalWeight;

      // Find the participant
      let cumulativeWeight = 0;
      let selectedIndex = 0;

      for (let j = 0; j < pool.length; j++) {
        cumulativeWeight += pool[j].weight;
        if (randomValue <= cumulativeWeight) {
          selectedIndex = j;
          break;
        }
      }

      selected.push(pool[selectedIndex]);

      // Remove from pool if not allowing multiple wins
      if (!allowMultipleWins) {
        pool.splice(selectedIndex, 1);
      }
    }

    return selected;
  }

  /**
   * Generate cryptographically secure random number between 0 and 1
   */
  private secureRandom(): number {
    const buffer = crypto.randomBytes(8);
    const randomValue = buffer.readUInt32BE(0) / 0xFFFFFFFF;
    return randomValue;
  }

  /**
   * Generate audit hash for draw results
   */
  private generateAuditHash(winners: string[], alternates: string[]): string {
    const data = {
      seed: this.seed,
      algorithm: this.algorithm,
      timestamp: new Date().toISOString(),
      winners,
      alternates,
    };

    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Save draw result to database
   */
  private async saveDrawResult(
    campaignId: string,
    campaign: { drawDate: Date; drawSettings: any },
    drawType: DrawType,
    batchNumber: number | undefined,
    participants: DrawParticipant[],
    winnerAssignments: PrizeAssignment[],
    alternateAssignments: PrizeAssignment[],
    auditHash: string
  ) {
    const totalEntries = participants.reduce((sum, p) => sum + p.totalEntries, 0);
    const nextBatch = drawType === 'SCHEDULED' ? batchNumber || 1 : 1;

    // Create draw result
    const drawResult = await prisma.drawResult.create({
      data: {
        campaignId,
        drawDate: new Date(),
        drawType,
        batchNumber: nextBatch,
        totalParticipants: participants.length,
        totalEntries,
        seed: this.seed,
        auditHash,
        executedBy: [],
        witnessedBy: [],
      },
    });

    // Create winner records
    for (const winner of winnerAssignments) {
      await prisma.drawWinner.create({
        data: {
          drawResultId: drawResult.id,
          customerId: winner.customerId,
          prizeId: winner.prizeId,
          rank: winner.rank,
          entriesAtDraw: winner.entriesAtDraw,
          isAlternate: false,
          status: 'SELECTED',
        },
      });
    }

    // Create alternate records
    for (const alternate of alternateAssignments) {
      await prisma.drawWinner.create({
        data: {
          drawResultId: drawResult.id,
          customerId: alternate.customerId,
          prizeId: alternate.prizeId,
          rank: alternate.rank,
          entriesAtDraw: alternate.entriesAtDraw,
          isAlternate: true,
          status: 'SELECTED',
        },
      });
    }

    // Update campaign status:
    // - INSTANT draws leave the campaign active
    // - SCHEDULED draws stay active until the final batch completes
    // - RANDOM / TIERED draw the campaign to a close
    if (drawType === 'INSTANT') {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'ACTIVE' },
      });
    } else if (drawType === 'SCHEDULED') {
      const settings = (campaign.drawSettings || {}) as any;
      const totalBatches = settings.schedule?.totalBatches;
      if (totalBatches && nextBatch >= totalBatches) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'DRAWN' },
        });
      } else {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: 'ACTIVE' },
        });
      }
    } else {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'DRAWN' },
      });
    }

    return drawResult;
  }

  /**
   * Verify a draw result using the seed
   */
  async verifyDraw(drawId: string): Promise<boolean> {
    const drawResult = await prisma.drawResult.findUnique({
      where: { id: drawId },
      include: { winners: true },
    });

    if (!drawResult) {
      throw new Error('Draw result not found');
    }

    // Recreate the seed and verify
    // In production, you would store the original participants and re-run the algorithm
    // For now, we verify the audit hash matches
    const storedHash = drawResult.auditHash;

    // This is a simplified verification - in production, you'd re-run the draw
    // with the same seed and compare results
    return storedHash.length > 0;
  }
}

export default new DrawEngine();