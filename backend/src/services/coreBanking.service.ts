import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import { messageQueue } from './messageQueue';

// ==================== Types ====================

interface BankTransactionEvent {
  customerId: string;
  accountId: string;
  transactionId: string;
  transactionType: string;
  amount: number;
  currency?: string;
  occurredAt?: string;
}

interface VerifedCustomer {
  customerId: string;
  name: string;
  isActive: boolean;
  accountTypes: string[];
}

interface EntryCreditResult {
  campaignId: string;
  campaignName: string;
  customerId: string;
  entryType: string;
  entriesEarned: number;
  cumulativeEntries: number;
  created: boolean;
  reason?: string;
}

// ==================== Core Banking Service ====================

/**
 * Adapter for the Sathapana core banking system.
 *
 * In development (no CORE_BANKING_API_URL configured) the adapter returns
 * deterministic mock data so the platform can be run fully offline.
 * In production, calls are forwarded to the core banking REST API using the
 * configured API key.
 */
export class CoreBankingService {
  private get baseUrl(): string {
    return config.coreBankingApiUrl || '';
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': config.coreBankingApiKey || '',
    };
  }

  private isMock(): boolean {
    return !config.coreBankingApiUrl || !config.coreBankingApiKey;
  }

  /**
   * Verify a customer exists and is active in the core banking system.
   */
  async verifyCustomer(customerId: string): Promise<VerifedCustomer> {
    if (this.isMock()) {
      return {
        customerId,
        name: `Customer ${customerId}`,
        isActive: true,
        accountTypes: ['SMART_SAVINGS', 'CURRENT'],
      };
    }

    const response = await axios.get(`${this.baseUrl}/customers/${customerId}`, {
      headers: this.headers,
    });
    return response.data.data as VerifedCustomer;
  }

  /**
   * List a customer's accounts from the core banking system.
   */
  async getCustomerAccounts(customerId: string) {
    if (this.isMock()) {
      return [
        {
          accountId: `ACC-${customerId}-01`,
          accountType: 'SMART_SAVINGS',
          currency: 'USD',
          status: 'ACTIVE',
        },
      ];
    }

    const response = await axios.get(`${this.baseUrl}/customers/${customerId}/accounts`, {
      headers: this.headers,
    });
    return response.data.data;
  }

  /**
   * Process a transaction event emitted by the core banking system.
   *
   * Matches the transaction against all active campaigns' entry rules and
   * credits the customer with the corresponding number of entries.
   */
  async processTransaction(event: BankTransactionEvent): Promise<EntryCreditResult[]> {
    const results: EntryCreditResult[] = [];

    const campaigns = await prisma.campaign.findMany({
      where: {
        status: { in: ['ACTIVE', 'DRAW_DAY'] },
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    for (const campaign of campaigns) {
      const result = await this.creditEntriesForCampaign(campaign, event);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private async creditEntriesForCampaign(
    campaign: { id: string; name: string; entryRules: any; notificationSettings: any },
    event: BankTransactionEvent
  ): Promise<EntryCreditResult | null> {
    const rules: any[] = campaign.entryRules || [];
    const normalizedTrigger = this.normalizeTrigger(event.transactionType);

    const matchingRule = rules.find((rule) => this.normalizeTrigger(rule.trigger) === normalizedTrigger);
    if (!matchingRule) {
      return null;
    }

    // Dedupe on the transaction id (unique per campaign + customer + transaction)
    if (event.transactionId) {
      const existing = await prisma.customerEntry.findUnique({
        where: {
          campaignId_customerId_triggerTransactionId: {
            campaignId: campaign.id,
            customerId: event.customerId,
            triggerTransactionId: event.transactionId,
          },
        },
      });

      if (existing) {
        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          customerId: event.customerId,
          entryType: normalizedTrigger,
          entriesEarned: 0,
          cumulativeEntries: existing.cumulativeEntries,
          created: false,
          reason: 'DUPLICATE_TRANSACTION',
        };
      }
    }

    let entriesEarned = 1;

    // Amount-based rule (e.g. 1 entry per USD 150 deposited)
    if (matchingRule.amountIncrement && matchingRule.entriesPerIncrement) {
      entriesEarned = Math.floor(event.amount / matchingRule.amountIncrement) * matchingRule.entriesPerIncrement;
      entriesEarned = Math.max(entriesEarned, 1);
    } else if (matchingRule.entriesPerAction) {
      entriesEarned = matchingRule.entriesPerAction;
    }

    const previousEntries = await prisma.customerEntry.aggregate({
      where: { campaignId: campaign.id, customerId: event.customerId },
      _sum: { entriesEarned: true },
    });

    const currentCumulative = previousEntries._sum.entriesEarned || 0;

    // Enforce per-customer cap from eligibility criteria
    const maxEntries = (campaign as any).eligibilityCriteria?.maxEntriesPerCustomer || 50;
    const remaining = maxEntries - currentCumulative;
    if (remaining <= 0) {
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        customerId: event.customerId,
        entryType: normalizedTrigger,
        entriesEarned: 0,
        cumulativeEntries: currentCumulative,
        created: false,
        reason: 'MAX_ENTRIES_REACHED',
      };
    }
    entriesEarned = Math.min(entriesEarned, remaining);

    const entry = await prisma.customerEntry.create({
      data: {
        customerId: event.customerId,
        campaignId: campaign.id,
        accountId: event.accountId,
        entryType: normalizedTrigger as any,
        entriesEarned,
        cumulativeEntries: currentCumulative + entriesEarned,
        triggerTransactionId: event.transactionId,
        verified: true,
        verificationSource: 'CORE_BANKING',
        metadata: {
          amount: event.amount,
          currency: event.currency,
          occurredAt: event.occurredAt,
        },
      },
    });

    // Best-effort notifications (must never fail the entry credit)
    try {
      await messageQueue.publish('notifications', 'ENTRY_CONFIRMATION', {
        customerId: event.customerId,
        campaignId: campaign.id,
        entriesEarned,
        totalEntries: entry.cumulativeEntries,
      });

      const isFirstEntry = currentCumulative === 0;
      const notificationSettings = campaign.notificationSettings || {};
      if (isFirstEntry && notificationSettings.welcomeMessage === true) {
        await messageQueue.publish('notifications', 'WELCOME', {
          customerId: event.customerId,
          campaignId: campaign.id,
          campaignName: campaign.name,
        });
      }
    } catch (error) {
      console.error('Failed to queue core banking notifications:', error);
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      customerId: event.customerId,
      entryType: normalizedTrigger,
      entriesEarned,
      cumulativeEntries: entry.cumulativeEntries,
      created: true,
    };
  }

  /**
   * Normalize a transaction / trigger string (e.g. "DEPOSIT", "deposit", "Deposit" → "DEPOSIT").
   */
  private normalizeTrigger(trigger: string): string {
    return trigger.toUpperCase().replace(/\s+/g, '_');
  }
}

export const coreBankingService = new CoreBankingService();