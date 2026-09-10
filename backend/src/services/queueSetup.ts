import { messageQueue } from './messageQueue';
import notificationService from './notification';

// Wire the in-memory message queue to the notification service.
// Registers a consumer for the 'notifications' queue that dispatches
// each message type to the corresponding NotificationService method.
export function setupQueueHandlers(): void {
  messageQueue.subscribe('notifications', async (message) => {
    const { type, data } = message;

    switch (type) {
      case 'WELCOME':
        await notificationService.sendWelcome(
          data.customerId,
          data.campaignId,
          data.campaignName
        );
        break;
      case 'ENTRY_CONFIRMATION':
        await notificationService.sendEntryConfirmation(
          data.customerId,
          data.campaignId,
          data.entriesEarned,
          data.totalEntries
        );
        break;
      case 'DRAW_REMINDER':
        await notificationService.sendDrawReminder(
          data.customerId,
          data.campaignId,
          data.campaignName,
          new Date(data.drawDate),
          data.totalEntries
        );
        break;
      case 'WINNER_ANNOUNCEMENT':
        await notificationService.sendWinnerAnnouncement(
          data.customerId,
          data.campaignId,
          data.campaignName,
          data.prizeName
        );
        break;
      default:
        console.warn(`[Queue] Unhandled notification type: ${type}`);
    }
  });
}