import { Request } from 'express';

// ==================== API Response Types ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== Auth Types ====================

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ==================== Campaign Types ====================

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: 'TRANSACTION_BASED' | 'DEPOSIT_BASED' | 'ACCOUNT_OPENING' | 'MILESTONE' | 'REFERRAL' | 'HYBRID';
  startDate: string;
  endDate: string;
  drawDate: string;
  eligibilityCriteria?: EligibilityCriteria;
  entryRules?: EntryRule[];
  drawSettings?: DrawSettings;
  termsAndConditions?: string;
  notificationSettings?: NotificationSettings;
}

export interface EligibilityCriteria {
  customerTypes?: string[];
  accountTypes?: string[];
  minimumDeposit?: number;
  currency?: string;
  geographicRestriction?: string[];
  ageMinimum?: number;
}

export interface EntryRule {
  ruleId?: string;
  trigger: string;
  entriesPerAction?: number;
  amountIncrement?: number;
  entriesPerIncrement?: number;
  maxEntriesPerCustomer?: number;
  description?: string;
}

export interface DrawSettings {
  drawType?: string;
  numberOfWinners?: number;
  numberOfAlternates?: number;
  allowMultipleWins?: boolean;
  verificationRequired?: boolean;
}

export interface NotificationSettings {
  welcomeMessage?: boolean;
  entryConfirmation?: boolean;
  drawReminder?: boolean;
  winnerAnnouncement?: boolean;
}

// ==================== Entry Types ====================

export interface RegisterEntryInput {
  customerId: string;
  campaignId: string;
  accountId?: string;
  entryType: string;
  triggerTransactionId?: string;
  metadata?: Record<string, any>;
}

// ==================== Draw Types ====================

export interface ExecuteDrawInput {
  campaignId: string;
  numberOfWinners?: number;
  numberOfAlternates?: number;
}

export interface DrawParticipant {
  customerId: string;
  totalEntries: number;
  weight: number;
}

// ==================== Prize Types ====================

export interface CreatePrizeInput {
  campaignId: string;
  rank: number;
  name: string;
  category: string;
  description?: string;
  quantity: number;
  estimatedValue: number;
  currency?: string;
  vendorName?: string;
  vendorContact?: Record<string, any>;
  fulfillmentInstructions?: string;
  alternativesOffered?: any[];
  termsAndConditions?: string;
}

// ==================== Query Types ====================

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface CampaignQuery extends PaginationQuery {
  status?: string;
  type?: string;
}

export interface EntryQuery extends PaginationQuery {
  customerId?: string;
  campaignId?: string;
  verified?: boolean;
}
