# Sathapana Bank Lucky Draw Platform

## 1. Introduction

### 1.1 Purpose
The Sathapana Bank Lucky Draw Platform is a digital solution designed to manage promotional lucky draw campaigns for Sathapana Bank (Cambodia) Plc. The platform enables the bank to run various customer engagement campaigns where customers earn entries/tickets through qualifying transactions and account activities, with the chance to win exciting prizes.

### 1.2 Background
Sathapana Bank regularly conducts promotional campaigns including lucky draws to encourage customer engagement with banking services such as savings accounts, mobile banking transactions, and fund transfers. This platform streamlines the management of these campaigns while ensuring transparency, compliance with Central Bank of Cambodia regulations, and an engaging customer experience.

### 1.3 Scope
This specification covers:
- Campaign management and configuration
- Customer entry/ticket earning rules
- Lucky draw execution and winner selection
- Prize management and fulfillment
- Customer-facing web and mobile interfaces
- Administrative dashboard
- Reporting and analytics
- Integration with core banking systems

---

## 2. System Overview

### 2.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     Customer Touchpoints                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Web Portal  │  │ Mobile App  │  │ USSD/SMS Interface      │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼───────────────────────┼──────────────┘
          │                │                       │
          ▼                ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway / Load Balancer                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Campaign    │  │  Entry/Ticket    │  │  Draw Engine     │
│  Service     │  │  Service         │  │  Service         │
└──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Campaign DB  │  │ Customer DB │  │ Transaction Log DB      │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                  │                     │
          └──────────────────┼─────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Core Banking Integration Layer                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Account Service  │  │ Transaction Svc │  │ Customer Svc    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

| Component | Description |
|-----------|-------------|
| Campaign Service | Manages campaign lifecycle, rules, and configuration |
| Entry/Ticket Service | Tracks customer entries, eligibility, and ticket generation |
| Draw Engine | Executes draws using cryptographically secure random selection |
| Prize Service | Manages prize inventory, allocation, and fulfillment tracking |
| Notification Service | Sends alerts via SMS, push notifications, and email |
| Reporting Service | Generates analytics, compliance reports, and audit logs |

---

## 3. Campaign Management

### 3.1 Campaign Types

| Type | Description | Example |
|------|-------------|---------|
| **Transaction-Based** | Earn entries per qualifying transaction | Every 5 mobile transactions = 1 entry |
| **Deposit-Based** | Earn entries based on deposit amounts | Every USD 150 top-up = 1 entry |
| **Account Opening** | Entries for opening new accounts | Open Smart Savings = 5 entries |
| **Milestone** | Entries for reaching account milestones | Maintain balance > USD 1,000 for 30 days |
| **Referral** | Entries for referring new customers | Each successful referral = 3 entries |
| **Hybrid** | Combination of multiple criteria | Transactions + deposits + referrals |

### 3.2 Campaign Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Draft   │────▶│ Scheduled│────▶│  Active  │────▶│ Draw Day │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                              ┌──────────────────────────┘
                              ▼
                         ┌──────────┐     ┌──────────┐
                         │ Drawn    │────▶│ Closed   │
                         └──────────┘     └──────────┘
```

| Status | Description |
|--------|-------------|
| **Draft** | Campaign is being configured; no customer visibility |
| **Scheduled** | Campaign is approved and will activate at the start date |
| **Active** | Campaign is live; customers can earn entries |
| **Draw Day** | Draw execution window (may span multiple time slots) |
| **Drawn** | Draw completed; winners selected and awaiting verification |
| **Closed** | All prizes fulfilled; campaign archived |

### 3.3 Campaign Configuration Fields

```json
{
  "campaignId": "CAMP-2025-001",
  "name": "Smart Savings Lucky Draw 2025",
  "description": "Open Smart Savings Account and win a Mazda EZ-6!",
  "type": "ACCOUNT_OPENING",
  "status": "ACTIVE",
  "startDate": "2025-05-01T00:00:00+07:00",
  "endDate": "2025-08-31T23:59:59+07:00",
  "drawDate": "2025-09-15T10:00:00+07:00",
  "eligibilityCriteria": {
    "customerTypes": ["INDIVIDUAL", "JOINT"],
    "accountTypes": ["SMART_SAVINGS"],
    "minimumDeposit": 100.00,
    "currency": "USD",
    "geographicRestriction": ["CAMBODIA"],
    "ageMinimum": 18
  },
  "entryRules": [
    {
      "ruleId": "RULE-001",
      "trigger": "ACCOUNT_OPENED",
      "entriesPerAction": 5,
      "maxEntriesPerCustomer": 20,
      "description": "5 entries for opening a new Smart Savings Account"
    },
    {
      "ruleId": "RULE-002",
      "trigger": "DEPOSIT",
      "amountIncrement": 150.00,
      "entriesPerIncrement": 1,
      "maxEntriesPerCustomer": 50,
      "description": "1 entry for every USD 150 deposited"
    }
  ],
  "drawSettings": {
    "drawType": "RANDOM",
    "numberOfWinners": 1,
    "numberOfAlternates": 3,
    "allowMultipleWins": false,
    "verificationRequired": true
  },
  "prizes": [
    {
      "prizeId": "PRIZE-001",
      "rank": 1,
      "name": "Mazda EZ-6",
      "type": "VEHICLE",
      "quantity": 1,
      "estimatedValue": 35000.00,
      "currency": "USD",
      "description": "Brand new Mazda EZ-6 Electric Vehicle"
    }
  ],
  "notifications": {
    "welcomeMessage": true,
    "entryConfirmation": true,
    "drawReminder": true,
    "winnerAnnouncement": true
  },
  "termsAndConditions": "terms-url-or-text",
  "createdAt": "2025-04-01T10:00:00+07:00",
  "createdBy": "admin@sathapana.com.kh",
  "approvedBy": "marketing@sathapana.com.kh",
  "approvedAt": "2025-04-15T14:30:00+07:00"
}
```

---

## 4. Customer Entry/Ticket System

### 4.1 Entry Earning Mechanisms

#### 4.1.1 Transaction-Based Earning
```json
{
  "transactionType": "FUND_TRANSFER",
  "qualifyingCriteria": {
    "minimumAmount": 50.00,
    "channel": ["MOBILE_APP", "WEB_BANKING"],
    "transferDirection": ["INTERNAL", "EXTERNAL"]
  },
  "entryCalculation": {
    "type": "THRESHOLD",
    "threshold": 5,
    "entriesPerThreshold": 1,
    "period": "CAMPAIGN_DURATION"
  }
}
```

#### 4.1.2 Deposit-Based Earning
```json
{
  "depositType": "TOP_UP",
  "qualifyingCriteria": {
    "accountType": "SMART_SAVINGS",
    "minimumAmount": 150.00,
    "channels": ["BRANCH", "MOBILE_APP", "ATM", "AGENT"]
  },
  "entryCalculation": {
    "type": "MULTIPLIER",
    "multiplier": 1,
    "perUnitAmount": 150.00,
    "period": "CAMPAIGN_DURATION"
  }
}
```

#### 4.1.3 Account Opening Earning
```json
{
  "trigger": "ACCOUNT_OPENED",
  "qualifyingCriteria": {
    "accountTypes": ["SMART_SAVINGS"],
    "minimumInitialDeposit": 100.00,
    "channels": ["BRANCH", "MOBILE_APP"]
  },
  "entryCalculation": {
    "type": "FLAT",
    "entries": 5,
    "maxOccurrences": 1
  }
}
```

### 4.2 Entry Tracking Data Model

```json
{
  "entryId": "ENTRY-2025-00000001",
  "customerId": "CUST-000001",
  "campaignId": "CAMP-2025-001",
  "accountId": "ACC-1234567890",
  "entryDate": "2025-05-15T09:30:00+07:00",
  "entryType": "DEPOSIT",
  "triggerTransactionId": "TXN-2025-05-00001234",
  "entriesEarned": 1,
  "cumulativeEntries": 3,
  "verified": true,
  "verificationSource": "CORE_BANKING_API",
  "metadata": {
    "depositAmount": 150.00,
    "accountBalance": 1250.00
  }
}
```

### 4.3 Entry Limits

| Limit Type | Default Value | Configurable |
|------------|---------------|--------------|
| Max entries per customer per campaign | 50 | Yes |
| Max entries per day | 10 | Yes |
| Max entries per transaction type | Varies by rule | Yes |
| Cool-down period between entries | None | Yes |

### 4.4 Duplicate Prevention
- Unique constraint on (campaignId, customerId, triggerTransactionId)
- Idempotency keys for all entry creation requests
- Real-time deduplication check before entry registration
- Audit trail for all rejected duplicate attempts

---

## 5. Draw Engine

### 5.1 Draw Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Random Selection** | Cryptographically secure random draw | Standard lucky draws |
| **Tiered Draw** | Separate draws for different entry levels | Multi-tier prize structures |
| **Scheduled Draw** | Multiple draws over campaign period | Weekly/monthly winners |
| **Instant Win** | Real-time win determination | Gamification campaigns |

### 5.2 Draw Execution Flow

```
┌────────────────────────────────────────────────────────────────┐
│                    Draw Execution Pipeline                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PRE-DRAW VALIDATION                                        │
│     ├── Verify campaign is in "Active" or "Draw Day" status    │
│     ├── Validate all entries are verified                       │
│     ├── Check draw date/time matches schedule                   │
│     └── Confirm prize inventory is available                    │
│                                                                 │
│  2. ELIGIBLE PARTICIPANT SNAPSHOT                               │
│     ├── Freeze eligible participant list at draw time           │
│     ├── Calculate total entries per participant                 │
│     ├── Generate weighted participant list                      │
│     └── Create audit record of participant snapshot             │
│                                                                 │
│  3. RANDOM SELECTION                                            │
│     ├── Initialize CSPRNG with entropy source                   │
│     ├── Execute weighted random selection algorithm             │
│     ├── Select winners based on campaign rules                  │
│     ├── Select alternates (if configured)                       │
│     └── Record selection seed for audit                         │
│                                                                 │
│  4. WINNER VERIFICATION                                         │
│     ├── Verify winner eligibility criteria                      │
│     ├── Check for account status (active, not frozen)           │
│     ├── Validate KYC compliance                                 │
│     ├── Check for fraud flags                                   │
│     └── Manual review queue (if required)                       │
│                                                                 │
│  5. RESULT PERSISTENCE                                          │
│     ├── Save draw results to database                           │
│     ├── Generate unique draw certificate                        │
│     ├── Create audit trail with timestamps                      │
│     └── Trigger notification workflow                           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 5.3 Cryptographic Random Selection

```typescript
interface DrawAlgorithm {
  type: "WEIGHTED_RANDOM";
  entropySource: "SYSTEM_RANDOM" | "HARDWARE_RNG";
  algorithm: "Fisher-Yates Shuffle with Weighting";
  seed: string; // Generated from CSPRNG, logged for audit
  auditHash: string; // SHA-256 of final results + seed
}

interface DrawInput {
  campaignId: string;
  participants: Participant[];
  numberOfWinners: number;
  numberOfAlternates: number;
  allowMultipleWins: boolean;
}

interface Participant {
  customerId: string;
  totalEntries: number; // Weight factor
  weight: number; // Calculated as totalEntries / totalEntriesAll
}

interface DrawResult {
  drawId: string;
  campaignId: string;
  drawTimestamp: string;
  seed: string;
  auditHash: string;
  winners: DrawResultEntry[];
  alternates: DrawResultEntry[];
}

interface DrawResultEntry {
  rank: number;
  customerId: string;
  entriesAtDrawTime: number;
  selectedAt: string;
  verified: boolean;
  verificationNotes: string;
}
```

### 5.4 Fairness Guarantees
- **Weighted probability**: Customers with more entries have proportionally higher chances
- **No replacement**: Winners are removed from pool for subsequent prize tiers (unless `allowMultipleWins` is true)
- **Deterministic replay**: Same seed produces same results for audit verification
- **Independent verification**: Results can be independently verified using the audit hash
- **Witness requirement**: Draw execution requires at least 2 authorized personnel

---

## 6. Prize Management

### 6.1 Prize Categories

| Category | Examples | Fulfillment Method |
|----------|----------|-------------------|
| **Vehicles** | Cars, motorcycles, e-bikes | Physical handover at ceremony |
| **Electronics** | Smartphones, watches, tablets | Physical handover or delivery |
| **Gold/Jewelry** | Gold bars, coins, jewelry | Physical handover at ceremony |
| **Cash Prizes** | Direct cash rewards | Account credit |
| **Travel** | Vacation packages, flights | Voucher/code delivery |
| **Services** | Fee waivers, premium upgrades | Account credit |
| **Merchandise** | Branded items, gift cards | Physical delivery or codes |

### 6.2 Prize Data Model

```json
{
  "prizeId": "PRIZE-2025-001",
  "campaignId": "CAMP-2025-001",
  "rank": 1,
  "name": "Mazda EZ-6 Electric Vehicle",
  "category": "VEHICLE",
  "description": "Brand new Mazda EZ-6 in the color of winner's choice",
  "quantity": 1,
  "allocated": 1,
  "fulfilled": 0,
  "estimatedValue": 35000.00,
  "actualValue": 32500.00,
  "currency": "USD",
  "taxApplicable": true,
  "taxRate": 0.0,
  "vendor": {
    "name": "Mazda Cambodia",
    "contactPerson": "Mr. Sok Vannak",
    "phone": "+855 23 123 456",
    "email": "sales@mazda-cambodia.com"
  },
  "fulfillmentInstructions": "Contact winner within 7 days. Vehicle handover ceremony at Sathapana HQ.",
  "alternativesOffered": [
    {
      "type": "CASH_EQUIVALENT",
      "value": 35000.00,
      "currency": "USD",
      "conditions": "If winner cannot accept physical prize"
    }
  ],
  "termsAndConditions": "Prize must be claimed within 30 days of announcement..."
}
```

### 6.3 Prize Fulfillment Workflow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Winner   │────▶│ Verify   │────▶│ Contact  │────▶│ Arrange  │
│ Selected │     │ Identity │     │ Winner   │     │ Delivery │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                              ┌──────────────────────────┘
                              ▼
                         ┌──────────┐     ┌──────────┐
                         │ Delivery │────▶│ Complete │
                         │ Ceremony │     │          │
                         └──────────┘     └──────────┘
```

### 6.4 Winner Claims Process
1. **Notification**: Winner receives SMS, push notification, and email
2. **Verification**: 7-day window to verify identity and eligibility
3. **Acceptance**: Winner confirms acceptance (physical prize or cash equivalent)
4. **Documentation**: Winner provides required documents (ID, tax forms)
5. **Fulfillment**: Prize delivered within 30 days of acceptance
6. **Public Announcement**: Winner listed on platform (with consent)

---

## 7. Customer-Facing Interface

### 7.1 Web Portal

#### 7.1.1 Campaign Landing Page
- Hero banner with campaign name, prize images, and CTA
- Campaign rules and terms & conditions
- Prize tier breakdown with images and values
- Entry progress tracker
- FAQ section
- "Enter Now" CTA button

#### 7.1.2 Entry Dashboard
```typescript
interface CustomerDashboard {
  campaignSummary: {
    campaignName: string;
    campaignStatus: "ACTIVE" | "DRAW_DAY" | "COMPLETED";
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
  entrySummary: {
    totalEntries: number;
    entriesThisWeek: number;
    entriesThisMonth: number;
    ranking: number; // Optional: show customer's position
  };
  recentEntries: EntryHistory[];
  prizes: PrizePreview[];
  winnerAnnouncements: WinnerAnnouncement[];
}
```

#### 7.1.3 Entry History
```typescript
interface EntryHistory {
  date: string;
  description: string; // "Top-up USD 150 to Smart Savings"
  entriesEarned: number;
  cumulativeEntries: number;
  transactionReference: string;
  verified: boolean;
}
```

### 7.2 Mobile App Integration

#### 7.2.1 Push Notifications
| Trigger | Message Template | Timing |
|---------|-----------------|--------|
| Entry earned | "🎉 You earned {n} entries! Total: {total}" | Real-time |
| Entry milestone | "🏆 You've reached {milestone} entries! Keep going!" | Real-time |
| Draw reminder | "⏰ Draw is in {days} days! You have {entries} entries" | 3 days before |
| Draw day | "🎊 Today is Draw Day! Good luck!" | 8:00 AM |
| Winner announced | "🌟 Winners have been announced! Check your status." | On draw completion |

#### 7.2.2 USSD Interface (Feature Phones)
```
*123# Sathapana Lucky Draw
├── 1. Check My Entries
├── 2. Campaign Info
├── 3. How to Earn More
├── 4. Winner List
└── 0. Back
```

### 7.3 Customer Eligibility Check

```typescript
interface EligibilityCheck {
  customerId: string;
  campaignId: string;
  eligible: boolean;
  reasons: string[]; // If not eligible
  currentEntries: number;
  maxEntries: number;
  nextEntryAvailableAt?: string; // If rate-limited
}
```

---

## 8. Administrative Dashboard

### 8.1 Dashboard Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Admin Dashboard                              │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Active       │  │  Total       │  │  Total       │         │
│  │  Campaigns: 3 │  │  Entries: 45K│  │  Winners: 12 │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Campaign Performance Chart                              │  │
│  │  [Daily entries, cumulative growth, conversion rates]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────┐  ┌──────────────────────────────┐   │
│  │  Recent Entries      │  │  Upcoming Draws              │   │
│  │  • CUST-001: +1 entry│  │  • Smart Savings: Sep 15     │   │
│  │  • CUST-002: +3 entry│  │  • Mobile Banking: Oct 1     │   │
│  │  • CUST-003: +1 entry│  │  • Referral: Nov 1           │   │
│  └──────────────────────┘  └──────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 8.2 Campaign Management Features

| Feature | Description |
|---------|-------------|
| **Create Campaign** | Form-based campaign creation with validation |
| **Edit Campaign** | Modify campaign settings (only in Draft/Scheduled) |
| **Activate Campaign** | Enable campaign for customer participation |
| **Pause Campaign** | Temporarily halt entry earning |
| **Close Campaign** | Archive completed campaign |
| **View Campaign** | Dashboard with real-time metrics |
| **Duplicate Campaign** | Clone existing campaign configuration |
| **Approve Campaign** | Multi-level approval workflow |

### 8.3 Draw Execution Interface

```typescript
interface DrawExecutionPanel {
  campaign: CampaignInfo;
  eligibility: {
    totalParticipants: number;
    totalEntries: number;
    verifiedEntries: number;
    unverifiedEntries: number;
  };
  preChecks: {
    campaignActive: boolean;
    drawDateMatch: boolean;
    entriesVerified: boolean;
    prizesAvailable: boolean;
    approversPresent: boolean;
  };
  execution: {
    authorizedPersonnel: string[];
    witnessCount: number;
    executionTimestamp: string;
    resultHash: string;
  };
}
```

### 8.4 User Roles and Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full access, system configuration, user management |
| **Campaign Manager** | Create, edit, activate, pause campaigns |
| **Marketing Manager** | View campaigns, approve campaigns, view reports |
| **Draw Operator** | Execute draws (with approval), view results |
| **Prize Coordinator** | Manage prizes, track fulfillment, update status |
| **Compliance Officer** | View audit logs, generate compliance reports |
| **Read-Only** | View dashboards and reports only |

### 8.5 Approval Workflow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Campaign │────▶│ Campaign │────▶│ Marketing│────▶│ Legal/   │
│ Created  │     │ Manager  │     │ Director │     │ Compliance│
│          │     │ Review   │     │ Approval │     │ Approval │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                              ┌──────────────────────────┘
                              ▼
                         ┌──────────┐
                         │ Campaign │
                         │ Activated│
                         └──────────┘
```

---

## 9. Integration Requirements

### 9.1 Core Banking System Integration

```typescript
interface CoreBankingIntegration {
  // Customer verification
  getCustomer(customerId: string): Promise<Customer>;
  verifyCustomerEligibility(customerId: string, campaignId: string): Promise<EligibilityResult>;
  
  // Account operations
  getAccount(accountId: string): Promise<Account>;
  getAccountBalance(accountId: string): Promise<Balance>;
  getAccountTransactions(accountId: string, dateRange: DateRange): Promise<Transaction[]>;
  
  // Transaction verification
  verifyTransaction(transactionId: string): Promise<VerificationResult>;
  getTransactionsByType(type: TransactionType, dateRange: DateRange): Promise<Transaction[]>;
}
```

### 9.2 SMS Gateway Integration

```typescript
interface SMSGateway {
  sendSMS(phoneNumber: string, message: string): Promise<SMSResult>;
  sendBulkSMS(recipients: SMSRecipient[]): Promise<BulkSMSResult>;
  checkDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}

interface SMSRecipient {
  phoneNumber: string;
  message: string;
  priority: "HIGH" | "NORMAL";
  campaignId?: string;
}
```

### 9.3 Push Notification Service

```typescript
interface PushNotificationService {
  sendPushNotification(userId: string, notification: PushNotification): Promise<void>;
  sendBulkPushNotification(userIds: string[], notification: PushNotification): Promise<void>;
}

interface PushNotification {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  priority: "HIGH" | "NORMAL";
}
```

### 9.4 Email Service

```typescript
interface EmailService {
  sendEmail(to: string, subject: string, templateId: string, data: Record<string, any>): Promise<void>;
  sendBulkEmail(recipients: EmailRecipient[], templateId: string): Promise<void>;
}
```

### 9.5 Document Management

```typescript
interface DocumentService {
  uploadDocument(file: File, metadata: DocumentMetadata): Promise<DocumentId>;
  getDocument(documentId: string): Promise<Document>;
  generateCertificate(templateId: string, data: Record<string, any>): Promise<DocumentId>;
}
```

---

## 10. Data Models

### 10.1 Core Entities

```typescript
// Campaign
interface Campaign {
  id: string;
  name: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  drawDate: string;
  eligibilityCriteria: EligibilityCriteria;
  entryRules: EntryRule[];
  drawSettings: DrawSettings;
  prizes: Prize[];
  notifications: NotificationSettings;
  termsAndConditions: string;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

// Customer Entry
interface CustomerEntry {
  id: string;
  customerId: string;
  campaignId: string;
  accountId?: string;
  entryType: EntryType;
  entriesEarned: number;
  cumulativeEntries: number;
  triggerTransactionId?: string;
  entryDate: string;
  verified: boolean;
  verificationSource: string;
  metadata: Record<string, any>;
}

// Draw Result
interface DrawResult {
  id: string;
  campaignId: string;
  drawDate: string;
  participants: DrawParticipant[];
  winners: DrawWinner[];
  alternates: DrawWinner[];
  auditHash: string;
  seed: string;
  executedBy: string[];
  witnessedBy: string[];
  metadata: Record<string, any>;
}

// Prize
interface Prize {
  id: string;
  campaignId: string;
  rank: number;
  name: string;
  category: PrizeCategory;
  description: string;
  quantity: number;
  allocated: number;
  fulfilled: number;
  estimatedValue: number;
  currency: string;
  vendor?: VendorInfo;
  fulfillmentInstructions: string;
}

// Winner
interface Winner {
  id: string;
  drawResultId: string;
  customerId: string;
  prizeId: string;
  status: WinnerStatus;
  verifiedAt?: string;
  contactedAt?: string;
  acceptedAt?: string;
  fulfilledAt?: string;
  notes: string;
}
```

### 10.2 Database Schema (PostgreSQL)

```sql
-- Campaigns table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    draw_date TIMESTAMPTZ NOT NULL,
    eligibility_criteria JSONB NOT NULL,
    entry_rules JSONB NOT NULL,
    draw_settings JSONB NOT NULL,
    terms_and_conditions TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by VARCHAR(255),
    updated_at TIMESTAMPTZ,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ
);

-- Customer entries table
CREATE TABLE customer_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    account_id VARCHAR(50),
    entry_type VARCHAR(50) NOT NULL,
    entries_earned INTEGER NOT NULL,
    cumulative_entries INTEGER NOT NULL,
    trigger_transaction_id VARCHAR(100),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    verification_source VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, customer_id, trigger_transaction_id)
);

-- Draw results table
CREATE TABLE draw_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    draw_date TIMESTAMPTZ NOT NULL,
    total_participants INTEGER NOT NULL,
    total_entries INTEGER NOT NULL,
    seed VARCHAR(255) NOT NULL,
    audit_hash VARCHAR(255) NOT NULL,
    executed_by TEXT[] NOT NULL,
    witnessed_by TEXT[] NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draw winners table
CREATE TABLE draw_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draw_result_id UUID NOT NULL REFERENCES draw_results(id),
    customer_id VARCHAR(50) NOT NULL,
    prize_id VARCHAR(50) NOT NULL,
    rank INTEGER NOT NULL,
    entries_at_draw INTEGER NOT NULL,
    is_alternate BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'SELECTED',
    verified_at TIMESTAMPTZ,
    contacted_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prizes table
CREATE TABLE prizes (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    rank INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    allocated INTEGER DEFAULT 0,
    fulfilled INTEGER DEFAULT 0,
    estimated_value DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    vendor_info JSONB,
    fulfillment_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_entries_customer ON customer_entries(customer_id);
CREATE INDEX idx_entries_campaign ON customer_entries(campaign_id);
CREATE INDEX idx_entries_date ON customer_entries(entry_date);
CREATE INDEX idx_winners_customer ON draw_winners(customer_id);
CREATE INDEX idx_winners_campaign ON draw_winners(prize_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);
```

---

## 11. Security Requirements

### 11.1 Authentication & Authorization

| Requirement | Implementation |
|-------------|----------------|
| **SSO Integration** | Integration with bank's existing SSO (Azure AD) |
| **Multi-Factor Authentication** | Required for all admin operations |
| **Role-Based Access Control** | Granular permissions per role |
| **Session Management** | 30-minute timeout, secure tokens |
| **API Authentication** | OAuth 2.0 with JWT tokens |
| **Customer Authentication** | Integrated with Sathapana Mobile App authentication |

### 11.2 Data Security

| Requirement | Implementation |
|-------------|----------------|
| **Encryption at Rest** | AES-256 for sensitive data (customer PII, prize details) |
| **Encryption in Transit** | TLS 1.3 for all communications |
| **Data Masking** | Customer IDs masked in logs; full IDs only in secure contexts |
| **PII Protection** | Customer data isolated and access-logged |
| **Audit Logging** | All data access and modifications logged |
| **Data Retention** | Campaign data retained for 7 years per regulatory requirements |

### 11.3 Draw Integrity

| Requirement | Implementation |
|-------------|----------------|
| **Cryptographic RNG** | Use system CSPRNG (e.g., `/dev/urandom`) |
| **Seed Logging** | All draw seeds recorded and auditable |
| **Tamper Detection** | Audit hashes using SHA-256 |
| **Witness Requirement** | Minimum 2 authorized personnel required |
| **Replay Capability** | Results can be independently verified using seed |

### 11.4 Fraud Prevention

| Threat | Mitigation |
|--------|------------|
| **Fake accounts** | KYC verification required for prize claiming |
| **Transaction manipulation** | Real-time verification with core banking |
| **Sybil attacks** | Device fingerprinting, behavioral analysis |
| **Collusion** | Random draw with no manual selection |
| **Prize hoarding** | Limits on entries per customer |

---

## 12. Performance Requirements

### 12.1 System Performance

| Metric | Target |
|--------|--------|
| **API Response Time** | < 200ms (95th percentile) |
| **Entry Registration** | < 500ms per entry |
| **Draw Execution** | < 5 seconds for 100K participants |
| **Dashboard Load Time** | < 2 seconds |
| **Concurrent Users** | 10,000+ |
| **Uptime** | 99.9% availability |

### 12.2 Scalability

| Component | Strategy |
|-----------|----------|
| **Entry Processing** | Horizontal scaling with message queue |
| **Draw Engine** | Batch processing with snapshot isolation |
| **Read Operations** | Redis caching for campaign data |
| **Search** | Elasticsearch for entry/customer lookups |
| **File Storage** | Object storage (S3-compatible) for documents |

### 12.3 Data Volume Estimates

| Data Type | Estimated Volume |
|-----------|-----------------|
| Active campaigns | 5-10 concurrent |
| Entries per campaign | 100K-500K |
| Total entries | 1M+ annually |
| Draw participants | Up to 500K per draw |
| Prize records | 100+ per year |
| Audit logs | 10M+ annually |

---

## 13. Compliance Requirements

### 13.1 Regulatory Compliance

| Regulation | Requirement |
|------------|-------------|
| **National Bank of Cambodia** | Campaign approval and reporting |
| **Anti-Money Laundering** | Customer verification for prize claiming |
| **Consumer Protection** | Clear terms and conditions disclosure |
| **Data Privacy** | Customer consent for data usage |
| **Tax Reporting** | Prize value reporting for tax purposes |

### 13.2 Audit Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Full audit trail** | All actions logged with timestamps |
| **Draw audit** | Complete draw execution record |
| **Financial audit** | Prize value tracking and reporting |
| **Access audit** | All data access logged |
| **Compliance reports** | Automated report generation |

### 13.3 Documentation Requirements

- Terms and conditions for each campaign
- Official rules for lucky draws
- Prize fulfillment records
- Winner consent forms
- Regulatory submission documents

---

## 14. Technical Specifications

### 14.1 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React.js (Web), React Native (Mobile) |
| **Backend** | Node.js / TypeScript |
| **API** | RESTful API with OpenAPI 3.0 specification |
| **Database** | PostgreSQL 15+ |
| **Cache** | Redis 7+ |
| **Message Queue** | RabbitMQ |
| **Search** | Elasticsearch 8+ |
| **Object Storage** | S3-compatible (MinIO) |
| **Containerization** | Docker / Kubernetes |
| **CI/CD** | GitHub Actions / Jenkins |
| **Monitoring** | Prometheus + Grafana |
| **Logging** | ELK Stack (Elasticsearch, Logstash, Kibana) |

### 14.2 API Endpoints

#### Campaign Endpoints
```
POST   /api/v1/campaigns                    # Create campaign
GET    /api/v1/campaigns                    # List campaigns
GET    /api/v1/campaigns/:id                # Get campaign details
PUT    /api/v1/campaigns/:id                # Update campaign
DELETE /api/v1/campaigns/:id                # Delete campaign (draft only)
POST   /api/v1/campaigns/:id/activate       # Activate campaign
POST   /api/v1/campaigns/:id/pause          # Pause campaign
POST   /api/v1/campaigns/:id/close          # Close campaign
```

#### Entry Endpoints
```
POST   /api/v1/entries                      # Register entry
GET    /api/v1/entries                      # List entries
GET    /api/v1/entries/:id                  # Get entry details
GET    /api/v1/customers/:id/entries        # Get customer entries
GET    /api/v1/customers/:id/summary        # Get customer entry summary
```

#### Draw Endpoints
```
POST   /api/v1/draws                        # Execute draw
GET    /api/v1/draws                        # List draws
GET    /api/v1/draws/:id                    # Get draw details
POST   /api/v1/draws/:id/verify             # Verify draw results
GET    /api/v1/draws/:id/winners            # Get draw winners
```

#### Prize Endpoints
```
GET    /api/v1/prizes                       # List prizes
GET    /api/v1/prizes/:id                   # Get prize details
PUT    /api/v1/prizes/:id                   # Update prize status
GET    /api/v1/prizes/:id/fulfillment       # Get fulfillment status
```

#### Customer Endpoints
```
GET    /api/v1/customers/:id/dashboard      # Get customer dashboard
GET    /api/v1/customers/:id/eligibility    # Check eligibility
GET    /api/v1/customers/:id/history        # Get entry history
```

#### Admin Endpoints
```
GET    /api/v1/admin/dashboard              # Admin dashboard stats
GET    /api/v1/admin/reports                # Generate reports
GET    /api/v1/admin/audit-logs             # View audit logs
POST   /api/v1/admin/users                  # Manage users
```

### 14.3 Environment Configuration

```bash
# Environment Variables
DATABASE_URL=postgresql://user:pass@host:5432/luckydraw
REDIS_URL=redis://host:6379
CORE_BANKING_API_URL=https://corebanking.sathapana.com.kh/api/v1
CORE_BANKING_API_KEY=xxx
SMS_GATEWAY_URL=https://sms.sathapana.com.kh/api
SMS_GATEWAY_API_KEY=xxx
PUSH_NOTIFICATION_URL=https://fcm.googleapis.com/v1/projects/xxx/messages:send
JWT_SECRET=xxx
ENCRYPTION_KEY=xxx
AWS_S3_BUCKET=sathapana-luckydraw-docs
AWS_REGION=ap-southeast-1
LOG_LEVEL=info
NODE_ENV=production
PORT=3000
```

---

## 15. Deployment Architecture

### 15.1 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (ALB)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                     Kubernetes Cluster                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Web App      │  │  API Server  │  │  Worker      │           │
│  │  (3 replicas) │  │  (3 replicas)│  │  (2 replicas)│           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Redis        │  │  PostgreSQL  │  │  Elasticsearch│          │
│  │  (Cluster)    │  │  (Primary +  │  │  (3 nodes)   │           │
│  │              │  │   Replica)   │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                     External Services                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Core Banking │  │  SMS Gateway │  │  S3 Storage  │           │
│  │  API          │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 15.2 Deployment Environments

| Environment | Purpose | Infrastructure |
|-------------|---------|---------------|
| **Development** | Local development and testing | Docker Compose |
| **Staging** | Pre-production testing | Kubernetes (dev cluster) |
| **UAT** | User acceptance testing | Kubernetes (UAT cluster) |
| **Production** | Live system | Kubernetes (production cluster) |

### 15.3 Backup & Recovery

| Component | Backup Frequency | Retention |
|-----------|-----------------|-----------|
| PostgreSQL | Hourly incremental, daily full | 30 days |
| Redis | Every 6 hours | 7 days |
| S3 Objects | Versioning enabled | Indefinite |
| Audit Logs | Real-time replication | 7 years |
| Configuration | On every change | Indefinite |

---

## 16. Monitoring & Alerting

### 16.1 Key Metrics

| Category | Metric | Alert Threshold |
|----------|--------|-----------------|
| **Availability** | API uptime | < 99.9% |
| **Performance** | API response time | > 500ms (p95) |
| **Performance** | Draw execution time | > 30s |
| **Errors** | API error rate | > 1% |
| **Errors** | Failed entries | > 5 per minute |
| **Business** | Entries per minute | < 10 (during active hours) |
| **Business** | Campaign activations | Manual notification |
| **System** | CPU usage | > 80% |
| **System** | Memory usage | > 85% |
| **System** | Disk usage | > 80% |
| **Database** | Connection pool usage | > 90% |
| **Cache** | Hit rate | < 80% |

### 16.2 Alert Channels

| Severity | Channel | Response Time |
|----------|---------|---------------|
| **Critical** | SMS + Email + Phone | 15 minutes |
| **High** | Email + Slack | 1 hour |
| **Medium** | Email + Slack | 4 hours |
| **Low** | Email | Next business day |

---

## 17. Testing Strategy

### 17.1 Test Types

| Type | Coverage Target | Tools |
|------|-----------------|-------|
| **Unit Tests** | 90%+ code coverage | Jest, Vitest |
| **Integration Tests** | All API endpoints | Supertest, Jest |
| **E2E Tests** | Critical user flows | Cypress, Playwright |
| **Load Tests** | 10K concurrent users | k6, Artillery |
| **Security Tests** | OWASP Top 10 | OWASP ZAP, Snyk |
| **Draw Algorithm Tests** | Statistical fairness | Custom test suite |

### 17.2 Draw Algorithm Testing

```
- Verify uniform distribution across multiple runs
- Verify weighted distribution matches entry proportions
- Test with edge cases (1 participant, max participants)
- Verify seed determinism (same seed = same results)
- Statistical tests (chi-squared, Kolmogorov-Smirnov)
- Performance tests with 500K+ participants
```

### 17.3 Test Environments

- **Unit/Integration**: In-memory database, mocked external services
- **E2E**: Dockerized environment with test data
- **Load**: Production-like environment with synthetic data
- **UAT**: Staging environment with bank test accounts

---

## 18. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project setup and infrastructure
- [ ] Database schema and migrations
- [ ] Core API implementation
- [ ] Basic campaign CRUD
- [ ] Authentication and authorization

### Phase 2: Entry System (Weeks 5-8)
- [ ] Entry earning rules engine
- [ ] Core banking integration
- [ ] Entry tracking and verification
- [ ] Customer entry dashboard

### Phase 3: Draw Engine (Weeks 9-12)
- [ ] Cryptographic draw implementation
- [ ] Draw execution interface
- [ ] Winner verification workflow
- [ ] Audit trail implementation

### Phase 4: Prize Management (Weeks 13-16)
- [ ] Prize CRUD and inventory
- [ ] Winner claims workflow
- [ ] Fulfillment tracking
- [ ] Prize ceremony support

### Phase 5: Customer Interface (Weeks 17-20)
- [ ] Campaign landing pages
- [ ] Customer dashboard (web)
- [ ] Mobile app integration
- [ ] USSD interface

### Phase 6: Admin & Reporting (Weeks 21-24)
- [ ] Admin dashboard
- [ ] Reports and analytics
- [ ] Audit log viewer
- [ ] Campaign approval workflow

### Phase 7: Launch Preparation (Weeks 25-28)
- [ ] Security audit and penetration testing
- [ ] Performance optimization
- [ ] UAT with bank staff
- [ ] Documentation and training
- [ ] Production deployment

---

## 19. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Draw manipulation** | High | Low | Cryptographic RNG, audit trail, witnesses |
| **Data breach** | Critical | Low | Encryption, access controls, monitoring |
| **System downtime** | High | Medium | Redundancy, failover, SLA monitoring |
| **Regulatory non-compliance** | High | Medium | Legal review, compliance officer role |
| **Customer fraud** | Medium | Medium | KYC verification, duplicate detection |
| **Integration failure** | High | Medium | Circuit breaker, retry logic, fallbacks |
| **Scalability issues** | Medium | Low | Load testing, auto-scaling, caching |

---

## 20. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Customer Participation** | 50K+ entries per campaign | Entry count |
| **Campaign Engagement** | 30%+ of eligible customers | Unique participants |
| **System Uptime** | 99.9%+ | Monitoring |
| **Draw Execution Time** | < 5 seconds | Performance logs |
| **Winner Response Rate** | 95%+ within 7 days | Claims tracking |
| **Customer Satisfaction** | 4.5+ stars | Survey |
| **Fraud Incidents** | 0 successful frauds | Security logs |

---

## 21. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Entry** | A single chance in a lucky draw, earned through qualifying actions |
| **Ticket** | Synonym for entry; represents customer's probability weight |
| **Draw** | The process of randomly selecting winners from eligible participants |
| **CSPRNG** | Cryptographically Secure Pseudo-Random Number Generator |
| **KYC** | Know Your Customer - identity verification process |
| **PII** | Personally Identifiable Information |
| **USSD** | Unstructured Supplementary Service Data (feature phone menu system) |

### Appendix B: Regulatory References

- National Bank of Cambodia Prakas on Consumer Protection
- Law on Anti-Money Laundering and Combating the Financing of Terrorism
- Prudential Guidelines for Commercial Banks
- Electronic Payment Services regulations

### Appendix C: Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-09-09 | System Architect | Initial specification |

---

*This specification is subject to review and approval by Sathapana Bank's IT Department, Marketing Department, Legal Department, and Compliance Department.*
