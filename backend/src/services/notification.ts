import prisma from '../config/database';
import { config } from '../config';

// ==================== Types ====================

interface SendNotificationInput {
  customerId: string;
  campaignId?: string;
  type: string;
  channel: string;
  subject?: string;
  message: string;
  metadata?: Record<string, any>;
}

// ==================== Notification Service ====================

export class NotificationService {
  /**
   * Send a notification
   */
  async send(input: SendNotificationInput): Promise<void> {
    // Save to database
    const notification = await prisma.notification.create({
      data: {
        customerId: input.customerId,
        campaignId: input.campaignId,
        type: input.type as any,
        channel: input.channel as any,
        subject: input.subject,
        message: input.message,
        metadata: input.metadata || {},
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Send via appropriate channel
    try {
      switch (input.channel) {
        case 'SMS':
          await this.sendSMS(input.customerId, input.message);
          break;
        case 'EMAIL':
          await this.sendEmail(input.customerId, input.subject || '', input.message);
          break;
        case 'PUSH':
          await this.sendPush(input.customerId, input.subject || '', input.message);
          break;
        case 'IN_APP':
          // Already saved to database
          break;
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' },
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });
    }
  }

  /**
   * Send a welcome notification for a new campaign participant
   */
  async sendWelcome(
    customerId: string,
    campaignId: string,
    campaignName: string
  ): Promise<void> {
    await this.send({
      customerId,
      campaignId,
      type: 'WELCOME',
      channel: 'PUSH',
      subject: `Welcome to ${campaignName}!`,
      message: `You are now a participant in ${campaignName}. Keep transacting to earn more entries!`,
      metadata: { campaignName },
    });
  }

  /**
   * Send entry confirmation
   */
  async sendEntryConfirmation(
    customerId: string,
    campaignId: string,
    entriesEarned: number,
    totalEntries: number
  ): Promise<void> {
    await this.send({
      customerId,
      campaignId,
      type: 'ENTRY_CONFIRMATION',
      channel: 'IN_APP',
      subject: 'Entry Confirmed',
      message: `You earned ${entriesEarned} entries! Total entries: ${totalEntries}`,
      metadata: { entriesEarned, totalEntries },
    });
  }

  /**
   * Send draw reminder
   */
  async sendDrawReminder(
    customerId: string,
    campaignId: string,
    campaignName: string,
    drawDate: Date,
    totalEntries: number
  ): Promise<void> {
    const daysUntilDraw = Math.ceil(
      (drawDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    await this.send({
      customerId,
      campaignId,
      type: 'DRAW_REMINDER',
      channel: 'PUSH',
      subject: 'Draw Reminder',
      message: `Draw for ${campaignName} is in ${daysUntilDraw} days! You have ${totalEntries} entries.`,
      metadata: { daysUntilDraw, totalEntries },
    });
  }

  /**
   * Send winner announcement
   */
  async sendWinnerAnnouncement(
    customerId: string,
    campaignId: string,
    campaignName: string,
    prizeName: string
  ): Promise<void> {
    await this.send({
      customerId,
      campaignId,
      type: 'WINNER_ANNOUNCEMENT',
      channel: 'PUSH',
      subject: 'Congratulations!',
      message: `You won ${prizeName} in ${campaignName}! Please check your email for next steps.`,
      metadata: { prizeName, campaignName },
    });

    // Also send SMS
    await this.send({
      customerId,
      campaignId,
      type: 'WINNER_ANNOUNCEMENT',
      channel: 'SMS',
      subject: 'Winner Announcement',
      message: `Congratulations! You won ${prizeName} in ${campaignName}. Check your email for details.`,
      metadata: { prizeName, campaignName },
    });
  }

  /**
   * Get customer notifications
   */
  async getCustomerNotifications(
    customerId: string,
    page = 1,
    limit = 20
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { customerId } }),
    ]);

    return { notifications, total, page, limit };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, customerId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, customerId },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  // ==================== Private Methods ====================

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // In production, integrate with SMS gateway (e.g., Twilio, Clickatell)
    console.log(`[SMS] To: ${phoneNumber}, Message: ${message}`);
    // Example with Twilio:
    // await twilioClient.messages.create({
    //   body: message,
    //   from: config.smsSender,
    //   to: phoneNumber,
    // });
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    // In production, integrate with email service (e.g., SendGrid, AWS SES)
    console.log(`[EMAIL] To: ${to}, Subject: ${subject}, Body: ${body}`);
    // Example with Nodemailer:
    // await transporter.sendMail({
    //   from: config.smtp.user,
    //   to,
    //   subject,
    //   text: body,
    // });
  }

  private async sendPush(userId: string, title: string, body: string): Promise<void> {
    // In production, integrate with Firebase Cloud Messaging
    console.log(`[PUSH] To: ${userId}, Title: ${title}, Body: ${body}`);
    // Example with Firebase Admin:
    // await admin.messaging().send({
    //   token: userToken,
    //   notification: { title, body },
    // });
  }
}

export default new NotificationService();
