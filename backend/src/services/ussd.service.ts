import prisma from '../config/database';

interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
  customerId?: string;
}

interface UssdResponse {
  sessionId: string;
  response: string; // "CON ..." for continuation, "END ..." to end the session
}

/**
 * USSD service for the *145# lucky draw menu.
 *
 * The telecom carrier sends { sessionId, phoneNumber, text }; `text` is the
 * cumulative user input (`""` on first request, then `"1"`, `"1*2"`, ...).
 * In production the gateway/proxy resolves the MSISDN to a `customerId` and
 * includes it in the payload; otherwise the menu guides the customer to check
 * eligibility by phone.
 */
export class UssdService {
  private static readonly SERVICE_CODE = '*145#';

  async handle(data: UssdRequest): Promise<UssdResponse> {
    const input = (data.text || '').replace(new RegExp(`^${UssdService.SERVICE_CODE.replace('*', '\\*')}`), '');
    const parts = input.split('*').filter((p) => p.length > 0);

    const customerId = data.customerId;

    if (input === '' || parts.length === 0) {
      return this.mainMenu(data.sessionId);
    }

    try {
      switch (parts[0]) {
        case '1':
          return await this.entriesMenu(data.sessionId, parts, customerId);
        case '2':
          return await this.winsMenu(data.sessionId, customerId);
        case '3':
          return await this.upcomingDraws(data.sessionId);
        case '4':
          return await this.eligibilityMenu(data.sessionId, parts, customerId);
        default:
          return this.end(data.sessionId, 'Invalid option. Please try again.');
      }
    } catch (error) {
      console.error('USSD error:', error);
      return this.end(data.sessionId, 'System error. Please try again later.');
    }
  }

  private mainMenu(sessionId: string): UssdResponse {
    return this.continue(
      sessionId,
      'Welcome to Sathapana Lucky Draw!\n' +
        '1. My Entries\n' +
        '2. My Wins\n' +
        '3. Upcoming Draws\n' +
        '4. Eligibility\n' +
        'Reply 0 to exit'
    );
  }

  private async entriesMenu(sessionId: string, parts: string[], customerId?: string): Promise<UssdResponse> {
    const resolved = await this.resolveCustomer(customerId);
    if (!resolved) {
      return this.end(sessionId, 'No linked account found. Please visit a Sathapana branch to link your phone.');
    }

    const campaigns = await prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'DRAW_DAY'] } },
      include: {
        entries: {
          where: { customerId: resolved },
          select: { entriesEarned: true },
        },
      },
    });

    const participating = campaigns.filter((c) => c.entries.length > 0);

    if (participating.length === 0) {
      return this.end(sessionId, 'You have no entries yet. Make qualifying transactions to earn entries.');
    }

    // Detail view: 1*<n>
    if (parts.length > 1) {
      const index = parseInt(parts[1], 10);
      if (index < 1 || index > participating.length) {
        return this.end(sessionId, 'Invalid campaign selection.');
      }
      const c = participating[index - 1];
      const total = c.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
      const drawDate = c.drawDate.toLocaleDateString('en-CA');
      return this.continue(
        sessionId,
        `${c.name}\nEntries: ${total}\nDraw: ${drawDate}\nReply 1 for more options`
      );
    }

    const lines = participating.slice(0, 5).map((c, i) => {
      const total = c.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
      return `${i + 1}. ${total} entries (${c.drawDate.toLocaleDateString('en-CA')})`;
    });

    return this.continue(sessionId, `Your Entries:\n${lines.join('\n')}\nReply 1*<n> for details`);
  }

  private async winsMenu(sessionId: string, customerId?: string): Promise<UssdResponse> {
    const resolved = await this.resolveCustomer(customerId);
    if (!resolved) {
      return this.end(sessionId, 'No linked account found. Please visit a Sathapana branch to link your phone.');
    }

    const wins = await prisma.drawWinner.findMany({
      where: {
        customerId: resolved,
        isAlternate: false,
        status: { notIn: ['DECLINED', 'EXPIRED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { prize: { select: { name: true } } },
    });

    if (wins.length === 0) {
      return this.end(sessionId, 'Congratulations! No wins yet - keep earning entries!');
    }

    const lines = wins.map((w, i) => `${i + 1}. ${w.prize.name} (${w.status})`);
    return this.continue(sessionId, `Your Wins:\n${lines.join('\n')}\nReply 2 again for more`);
  }

  private async upcomingDraws(sessionId: string): Promise<UssdResponse> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['ACTIVE', 'DRAW_DAY'] },
        drawDate: { gte: new Date() },
      },
      orderBy: { drawDate: 'asc' },
      take: 5,
    });

    if (campaigns.length === 0) {
      return this.end(sessionId, 'No upcoming draws right now. Please check back later.');
    }

    const lines = campaigns.map((c, i) => `${i + 1}. ${c.name}: ${c.drawDate.toLocaleDateString('en-CA')}`);
    return this.continue(sessionId, `Upcoming Draws:\n${lines.join('\n')}`);
  }

  private async eligibilityMenu(sessionId: string, parts: string[], customerId?: string): Promise<UssdResponse> {
    const resolved = await this.resolveCustomer(customerId);
    if (!resolved) {
      return this.end(sessionId, 'No linked account found. Please visit a Sathapana branch to link your phone.');
    }

    const campaigns = await prisma.campaign.findMany({
      where: { status: { in: ['ACTIVE', 'DRAW_DAY'] } },
      include: {
        entries: {
          where: { customerId: resolved },
          select: { entriesEarned: true },
        },
      },
    });

    const eligible = campaigns.filter((c) => {
      const criteria = (c.eligibilityCriteria || {}) as any;
      const maxEntries = criteria.maxEntriesPerCustomer || 50;
      const total = c.entries.reduce((sum, e) => sum + e.entriesEarned, 0);
      return total < maxEntries;
    });

    if (eligible.length === 0) {
      return this.end(sessionId, 'You are fully entered in all active campaigns. Thank you!');
    }

    return this.continue(
      sessionId,
      `Eligible Campaigns:\n${eligible.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}`
    );
  }

  private resolveCustomer(customerId?: string): string | null {
    if (customerId && customerId.length > 0) return customerId;
    // In production: look up MSISDN -> customerId from the core banking system.
    return null;
  }

  private continue(sessionId: string, message: string): UssdResponse {
    return { sessionId, response: message.startsWith('CON ') ? message : `CON ${message}` };
  }

  private end(sessionId: string, message: string): UssdResponse {
    return { sessionId, response: message.startsWith('END ') ? message : `END ${message}` };
  }
}

export const ussdService = new UssdService();