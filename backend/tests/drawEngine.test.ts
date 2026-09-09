import crypto from 'crypto';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prize: {
      findMany: jest.fn(),
    },
    customerEntry: {
      groupBy: jest.fn(),
    },
    drawResult: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    drawWinner: {
      create: jest.fn(),
    },
  },
}));

import prisma from '../src/config/database';
import { DrawEngine } from '../src/services/drawEngine';

describe('DrawEngine', () => {
  let drawEngine: DrawEngine;

  beforeEach(() => {
    drawEngine = new DrawEngine();
    jest.clearAllMocks();
  });

  describe('executeDraw', () => {
    const mockCampaign = {
      id: 'campaign-1',
      status: 'ACTIVE',
      drawDate: new Date('2025-01-01'),
      drawSettings: {
        drawType: 'RANDOM',
        numberOfWinners: 1,
        numberOfAlternates: 3,
      },
    };

    const mockPrizes = [
      { id: 'prize-1', rank: 1, name: 'Car', quantity: 1 },
      { id: 'prize-2', rank: 2, name: 'Gold', quantity: 5 },
    ];

    const mockEntries = [
      { customerId: 'cust-1', _sum: { entriesEarned: 10 } },
      { customerId: 'cust-2', _sum: { entriesEarned: 5 } },
      { customerId: 'cust-3', _sum: { entriesEarned: 3 } },
      { customerId: 'cust-4', _sum: { entriesEarned: 2 } },
    ];

    const mockDrawResult = {
      id: 'draw-1',
      campaignId: 'campaign-1',
      drawDate: new Date(),
      totalParticipants: 4,
      totalEntries: 20,
      seed: 'test-seed',
      auditHash: 'test-hash',
      executedBy: [],
      witnessedBy: [],
    };

    beforeEach(() => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);
      (prisma.prize.findMany as jest.Mock).mockResolvedValue(mockPrizes);
      (prisma.customerEntry.groupBy as jest.Mock).mockResolvedValue(mockEntries);
      (prisma.drawResult.create as jest.Mock).mockResolvedValue(mockDrawResult);
      (prisma.drawWinner.create as jest.Mock).mockResolvedValue({});
      (prisma.campaign.update as jest.Mock).mockResolvedValue({});
    });

    it('should execute a draw successfully', async () => {
      const result = await drawEngine.executeDraw({
        campaignId: 'campaign-1',
        numberOfWinners: 1,
        numberOfAlternates: 3,
        allowMultipleWins: false,
      });

      expect(result).toHaveProperty('drawId');
      expect(result).toHaveProperty('seed');
      expect(result).toHaveProperty('auditHash');
      expect(result).toHaveProperty('winners');
      expect(result).toHaveProperty('alternates');
      expect(result.winners).toHaveLength(1);
      expect(result.alternates).toHaveLength(3);
    });

    it('should generate a valid seed', async () => {
      const result = await drawEngine.executeDraw({
        campaignId: 'campaign-1',
        numberOfWinners: 1,
        numberOfAlternates: 1,
        allowMultipleWins: false,
      });

      // Seed should be a 64 character hex string (32 bytes)
      expect(result.seed).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate a valid audit hash', async () => {
      const result = await drawEngine.executeDraw({
        campaignId: 'campaign-1',
        numberOfWinners: 1,
        numberOfAlternates: 1,
        allowMultipleWins: false,
      });

      // Audit hash should be a 64 character hex string (SHA-256)
      expect(result.auditHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should throw error if campaign not found', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        drawEngine.executeDraw({
          campaignId: 'nonexistent',
          numberOfWinners: 1,
          numberOfAlternates: 1,
          allowMultipleWins: false,
        })
      ).rejects.toThrow('Campaign not found');
    });

    it('should throw error if campaign is not active', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        status: 'DRAFT',
      });

      await expect(
        drawEngine.executeDraw({
          campaignId: 'campaign-1',
          numberOfWinners: 1,
          numberOfAlternates: 1,
          allowMultipleWins: false,
        })
      ).rejects.toThrow('Campaign is not in a valid state for drawing');
    });

    it('should throw error if draw date not reached', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        ...mockCampaign,
        drawDate: new Date('2099-12-31'),
      });

      await expect(
        drawEngine.executeDraw({
          campaignId: 'campaign-1',
          numberOfWinners: 1,
          numberOfAlternates: 1,
          allowMultipleWins: false,
        })
      ).rejects.toThrow('Draw date has not been reached');
    });

    it('should throw error if no eligible participants', async () => {
      (prisma.customerEntry.groupBy as jest.Mock).mockResolvedValue([]);

      await expect(
        drawEngine.executeDraw({
          campaignId: 'campaign-1',
          numberOfWinners: 1,
          numberOfAlternates: 1,
          allowMultipleWins: false,
        })
      ).rejects.toThrow('No eligible participants found');
    });

    it('should throw error if not enough prizes', async () => {
      (prisma.prize.findMany as jest.Mock).mockResolvedValue([
        { id: 'prize-1', rank: 1, name: 'Car', quantity: 1 },
      ]);

      await expect(
        drawEngine.executeDraw({
          campaignId: 'campaign-1',
          numberOfWinners: 5,
          numberOfAlternates: 1,
          allowMultipleWins: false,
        })
      ).rejects.toThrow('Not enough prizes available');
    });
  });

  describe('weightedRandomSelection', () => {
    it('should select winners based on weight', () => {
      const participants = [
        { customerId: 'cust-1', totalEntries: 10, weight: 0.5 },
        { customerId: 'cust-2', totalEntries: 5, weight: 0.25 },
        { customerId: 'cust-3', totalEntries: 5, weight: 0.25 },
      ];

      // Run multiple times to verify weighting
      const selections = new Map<string, number>();
      
      for (let i = 0; i < 1000; i++) {
        const result = (drawEngine as any).weightedRandomSelection(participants, 1, false);
        const id = result[0].customerId;
        selections.set(id, (selections.get(id) || 0) + 1);
      }

      // cust-1 should be selected more often (50% weight)
      const cust1Count = selections.get('cust-1') || 0;
      expect(cust1Count).toBeGreaterThan(400); // Should be around 500
    });

    it('should not select same winner twice when allowMultipleWins is false', () => {
      const participants = [
        { customerId: 'cust-1', totalEntries: 10, weight: 0.5 },
        { customerId: 'cust-2', totalEntries: 5, weight: 0.25 },
        { customerId: 'cust-3', totalEntries: 5, weight: 0.25 },
      ];

      const result = (drawEngine as any).weightedRandomSelection(participants, 3, false);
      const customerIds = result.map((r: any) => r.customerId);
      
      // All should be unique
      expect(new Set(customerIds).size).toBe(3);
    });

    it('should allow same winner multiple times when allowMultipleWins is true', () => {
      const participants = [
        { customerId: 'cust-1', totalEntries: 100, weight: 0.9 },
        { customerId: 'cust-2', totalEntries: 1, weight: 0.1 },
      ];

      // With high weight for cust-1, they should be selected multiple times
      let foundDuplicate = false;
      
      for (let i = 0; i < 100; i++) {
        const result = (drawEngine as any).weightedRandomSelection(participants, 3, true);
        const customerIds = result.map((r: any) => r.customerId);
        
        if (new Set(customerIds).size < 3) {
          foundDuplicate = true;
          break;
        }
      }
      
      expect(foundDuplicate).toBe(true);
    });
  });

  describe('generateSeed', () => {
    it('should generate a unique seed each time', () => {
      const seed1 = (drawEngine as any).generateSeed();
      const seed2 = (drawEngine as any).generateSeed();
      
      expect(seed1).not.toBe(seed2);
      expect(seed1).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('generateAuditHash', () => {
    it('should generate consistent hash for same input', () => {
      const winners = [{ customerId: 'cust-1', totalEntries: 10, weight: 0.5 }];
      const alternates = [{ customerId: 'cust-2', totalEntries: 5, weight: 0.25 }];
      
      (drawEngine as any).seed = 'test-seed';
      
      const hash1 = (drawEngine as any).generateAuditHash(winners, alternates);
      const hash2 = (drawEngine as any).generateAuditHash(winners, alternates);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different input', () => {
      const winners1 = [{ customerId: 'cust-1', totalEntries: 10, weight: 0.5 }];
      const winners2 = [{ customerId: 'cust-2', totalEntries: 5, weight: 0.25 }];
      const alternates: any[] = [];
      
      (drawEngine as any).seed = 'test-seed';
      
      const hash1 = (drawEngine as any).generateAuditHash(winners1, alternates);
      const hash2 = (drawEngine as any).generateAuditHash(winners2, alternates);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('secureRandom', () => {
    it('should return a number between 0 and 1', () => {
      for (let i = 0; i < 100; i++) {
        const value = (drawEngine as any).secureRandom();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });
});
