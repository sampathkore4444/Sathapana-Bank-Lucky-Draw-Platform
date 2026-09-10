import prisma from '../config/database';
import { config } from '../config';
import { messageQueue } from './messageQueue';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lightweight in-process scheduler that runs periodic housekeeping jobs.
 * In production this can be replaced with a dedicated worker (e.g. node-cron
 * or a Redis-backed job queue) without changing the job implementations.
 */
export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (this.timer) return;
    if (!config.schedulerEnabled) {
      console.log('[Scheduler] Disabled via SCHEDULER_ENABLED=false');
      return;
    }

    const run = (): void => void this.runJobs();

    // Run once on start, then on an interval
    this.timer = setInterval(run, config.schedulerIntervalMinutes * 60 * 1000);
    setTimeout(run, 10 * 1000);

    console.log(
      `[Scheduler] Started (every ${config.schedulerIntervalMinutes} minutes)`
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runJobs(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.activateScheduledCampaigns();
      await this.moveCampaignsToDrawDay();
      await this.sendDrawReminders();
      await this.expireStaleWinners();
      await this.closeCompletedCampaigns();
    } catch (error) {
      console.error('[Scheduler] Job run failed:', error);
    } finally {
      this.running = false;
    }
  }

  /**
   * Move SCHEDULED campaigns to ACTIVE once their start date has arrived.
   */
  private async activateScheduledCampaigns(): Promise<void> {
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'SCHEDULED', startDate: { lte: new Date() } },
      select: { id: true },
    });

    for (const campaign of campaigns) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: 'ACTIVE',
          metadata: { scheduledActivatedAt: new Date().toISOString() },
        },
      });
      console.log(`[Scheduler] Activated campaign ${campaign.id}`);
    }
  }

  /**
   * Move ACTIVE campaigns to DRAW_DAY as their draw date approaches.
   */
  private async moveCampaignsToDrawDay(): Promise<void> {
    const threshold = new Date(Date.now() + DAY_MS);
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        drawDate: { lte: threshold },
      },
      select: { id: true },
    });

    for (const campaign of campaigns) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'DRAW_DAY' },
      });
      console.log(`[Scheduler] Campaign ${campaign.id} moved to DRAW_DAY`);
    }
  }

  /**
   * Send draw reminders to participants of campaigns drawing within 3 days.
   * Deduplicated using campaign metadata (lastReminderSentAt).
   */
  private async sendDrawReminders(): Promise<void> {
    const reminderWindow = 3 * DAY_MS;
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['ACTIVE', 'DRAW_DAY'] },
        drawDate: { lte: new Date(Date.now() + reminderWindow) },
      },
    });

    for (const campaign of campaigns) {
      const settings = (campaign.notificationSettings || {}) as any;
      const metadata = (campaign.metadata || {}) as any;

      if (settings.drawReminder === false) continue;
      if (metadata.lastReminderSentAt) continue;

      const participants = await prisma.customerEntry.groupBy({
        by: ['customerId'],
        where: { campaignId: campaign.id },
        _sum: { entriesEarned: true },
      });

      for (const participant of participants) {
        try {
          await messageQueue.publish('notifications', 'DRAW_REMINDER', {
            customerId: participant.customerId,
            campaignId: campaign.id,
            campaignName: campaign.name,
            drawDate: campaign.drawDate.toISOString(),
            totalEntries: participant._sum.entriesEarned || 0,
          });
        } catch (error) {
          console.error('Failed to queue draw reminder:', error);
        }
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          metadata: { ...metadata, lastReminderSentAt: new Date().toISOString() },
        },
      });

      console.log(`[Scheduler] Sent draw reminders for campaign ${campaign.id}`);
    }
  }

  /**
   * Expire winners who were contacted but did not accept within the expiry
   * window, then promote an alternate for the affected prize.
   */
  private async expireStaleWinners(): Promise<void> {
    const expiryDays = config.winnerExpiryDays;
    const cutoff = new Date(Date.now() - expiryDays * DAY_MS);

    const staleWinners = await prisma.drawWinner.findMany({
      where: {
        isAlternate: false,
        acceptedAt: null,
        status: { in: ['SELECTED', 'VERIFIED', 'CONTACTED'] },
        contactedAt: { lte: cutoff },
      },
    });

    for (const winner of staleWinners) {
      await prisma.drawWinner.update({
        where: { id: winner.id },
        data: { status: 'EXPIRED', notes: 'Expired by scheduler: no acceptance within window' },
      });

      // Promote the next alternate for the same draw + prize
      const alternate = await prisma.drawWinner.findFirst({
        where: {
          drawResultId: winner.drawResultId,
          prizeId: winner.prizeId,
          isAlternate: true,
          status: 'SELECTED',
        },
        orderBy: { rank: 'asc' },
      });

      if (alternate) {
        await prisma.drawWinner.update({
          where: { id: alternate.id },
          data: { isAlternate: false, rank: winner.rank, status: 'SELECTED' },
        });
      }

      // Notify the new winner (best-effort)
      try {
        const draw = await prisma.drawResult.findUnique({
          where: { id: winner.drawResultId },
          include: { campaign: { select: { name: true } } },
        });
        const prize = await prisma.prize.findUnique({
          where: { id: winner.prizeId },
          select: { name: true },
        });
        if (draw && prize) {
          await messageQueue.publish('notifications', 'WINNER_ANNOUNCEMENT', {
            customerId: alternate?.customerId || winner.customerId,
            campaignId: draw.campaignId,
            campaignName: draw.campaign.name,
            prizeName: prize.name,
          });
        }
      } catch (error) {
        console.error('Failed to notify promoted winner:', error);
      }

      console.log(`[Scheduler] Expired winner ${winner.id}`);
    }
  }

  /**
   * Close campaigns whose draws are complete and whose end date passed + grace period.
   */
  private async closeCompletedCampaigns(): Promise<void> {
    const graceDate = new Date(Date.now() - 30 * DAY_MS);
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: 'DRAWN',
        endDate: { lte: graceDate },
      },
      select: { id: true },
    });

    for (const campaign of campaigns) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'CLOSED' },
      });
      console.log(`[Scheduler] Closed campaign ${campaign.id}`);
    }
  }
}

export const schedulerService = new SchedulerService();