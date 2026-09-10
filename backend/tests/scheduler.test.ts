import { schedulerService } from '../src/services/scheduler.service';

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    campaign: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    customerEntry: {
      groupBy: jest.fn(),
    },
    drawWinner: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    drawResult: {
      findUnique: jest.fn(),
    },
    prize: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../src/services/messageQueue', () => ({
  __esModule: true,
  messageQueue: {
    publish: jest.fn().mockResolvedValue('msg-id'),
  },
}));

import prisma from '../src/config/database';

const campaignFindMany = prisma.campaign.findMany as jest.Mock;
const campaignUpdate = prisma.campaign.update as jest.Mock;
const customerEntryGroupBy = prisma.customerEntry.groupBy as jest.Mock;
const drawWinnerFindMany = prisma.drawWinner.findMany as jest.Mock;
const drawWinnerFindFirst = prisma.drawWinner.findFirst as jest.Mock;
const drawWinnerUpdate = prisma.drawWinner.update as jest.Mock;
const drawResultFindUnique = prisma.drawResult.findUnique as jest.Mock;
const prizeFindUnique = prisma.prize.findUnique as jest.Mock;

describe('Scheduler Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    [
      campaignFindMany,
      campaignUpdate,
      customerEntryGroupBy,
      drawWinnerFindMany,
      drawWinnerFindFirst,
      drawWinnerUpdate,
      drawResultFindUnique,
      prizeFindUnique,
    ].forEach((m) => m.mockReset());
    drawWinnerFindMany.mockResolvedValue([]);
  });

  describe('runJobs', () => {
    it('should activate scheduled campaigns whose start date has arrived', async () => {
      campaignFindMany
        .mockResolvedValueOnce([{ id: 'c1', startDate: new Date() }]) // activateScheduledCampaigns
        .mockResolvedValueOnce([]) // moveCampaignsToDrawDay
        .mockResolvedValueOnce([]) // sendDrawReminders
        .mockResolvedValueOnce([]) // expireStaleWinners
        .mockResolvedValueOnce([]); // closeCompletedCampaigns
      campaignUpdate.mockResolvedValue({});

      await schedulerService.runJobs();

      expect(campaignUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ status: 'ACTIVE' }),
        })
      );
    });

    it('should move active campaigns to DRAW_DAY within 24h of the draw', async () => {
      campaignFindMany
        .mockResolvedValueOnce([]) // activateScheduledCampaigns
        .mockResolvedValueOnce([{ id: 'c1', drawDate: new Date(Date.now() + 2 * 3600 * 1000) }]) // moveCampaignsToDrawDay
        .mockResolvedValueOnce([]) // sendDrawReminders
        .mockResolvedValueOnce([]) // expireStaleWinners
        .mockResolvedValueOnce([]); // closeCompletedCampaigns
      campaignUpdate.mockResolvedValue({});

      await schedulerService.runJobs();

      expect(campaignUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ status: 'DRAW_DAY' }),
        })
      );
    });

    it('should send draw reminders once per campaign', async () => {
      const { messageQueue } = require('../src/services/messageQueue');

      campaignFindMany
        .mockResolvedValueOnce([]) // activateScheduledCampaigns
        .mockResolvedValueOnce([]) // moveCampaignsToDrawDay
        .mockResolvedValueOnce([
          {
            id: 'c1',
            name: 'Campaign A',
            drawDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            notificationSettings: { drawReminder: true },
            metadata: {},
          },
        ]) // sendDrawReminders
        .mockResolvedValueOnce([]) // expireStaleWinners
        .mockResolvedValueOnce([]); // closeCompletedCampaigns

      customerEntryGroupBy.mockResolvedValue([
        { customerId: 'cust-1', _sum: { entriesEarned: 5 } },
      ]);
      campaignUpdate.mockResolvedValue({});

      await schedulerService.runJobs();

      expect(messageQueue.publish).toHaveBeenCalledWith(
        'notifications',
        'DRAW_REMINDER',
        expect.objectContaining({ customerId: 'cust-1', campaignId: 'c1' })
      );
      // metadata update prevents re-sending
      const updateCall = campaignUpdate.mock.calls.find((call) =>
        JSON.stringify(call[0].data).includes('lastReminderSentAt')
      );
      expect(updateCall).toBeDefined();
    });

    it('should expire stale winners and promote an alternate', async () => {
      campaignFindMany
        .mockResolvedValueOnce([]) // activateScheduledCampaigns
        .mockResolvedValueOnce([]) // moveCampaignsToDrawDay
        .mockResolvedValueOnce([]) // sendDrawReminders
        .mockResolvedValueOnce([]); // closeCompletedCampaigns

      drawWinnerFindMany.mockResolvedValue([
        {
          id: 'w1',
          drawResultId: 'dr-1',
          prizeId: 'prize-1',
          customerId: 'cust-1',
          status: 'CONTACTED',
          contactedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      ]);

      drawWinnerFindFirst.mockResolvedValue({
        id: 'w2',
        customerId: 'cust-2',
        drawResultId: 'dr-1',
        prizeId: 'prize-1',
        isAlternate: true,
        status: 'SELECTED',
      });
      drawWinnerUpdate.mockResolvedValue({});
      drawResultFindUnique.mockResolvedValue({
        id: 'dr-1',
        campaignId: 'c1',
        campaign: { name: 'Campaign A' },
      });
      prizeFindUnique.mockResolvedValue({ name: 'Gold Bar' });

      await schedulerService.runJobs();

      expect(drawWinnerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w1' },
          data: expect.objectContaining({ status: 'EXPIRED' }),
        })
      );
      // alternate promoted
      expect(drawWinnerUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w2' },
          data: expect.objectContaining({ isAlternate: false, status: 'SELECTED' }),
        })
      );
    });

    it('should close long-drawn campaigns after the grace period', async () => {
      campaignFindMany
        .mockResolvedValueOnce([]) // activateScheduledCampaigns
        .mockResolvedValueOnce([]) // moveCampaignsToDrawDay
        .mockResolvedValueOnce([]) // sendDrawReminders
        .mockResolvedValueOnce([{ id: 'c1', drawDate: new Date() }]); // closeCompletedCampaigns
      campaignUpdate.mockResolvedValue({});

      await schedulerService.runJobs();

      expect(campaignUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ status: 'CLOSED' }),
        })
      );
    });
  });
});