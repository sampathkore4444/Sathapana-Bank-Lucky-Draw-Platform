# Sathapana Bank Lucky Draw Platform
# Complete End-to-End Flow Documentation

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Phase 1: Authentication Flow](#5-phase-1-authentication-flow)
6. [Phase 2: Campaign Management Flow](#6-phase-2-campaign-management-flow)
7. [Phase 3: Entry/Ticket Earning Flow](#7-phase-3-entryticket-earning-flow)
8. [Phase 4: Draw Execution Flow](#8-phase-4-draw-execution-flow)
9. [Phase 5: Prize & Winner Management Flow](#9-phase-5-prize--winner-management-flow)
10. [Phase 6: Admin Dashboard Flow](#10-phase-6-admin-dashboard-flow)
11. [Frontend-Backend Communication](#11-frontend-backend-communication)
12. [Database Flow](#12-database-flow)
13. [Security Flow](#13-security-flow)
14. [Starting & Stopping Servers](#14-starting--stopping-servers)
15. [Load Testing Guide](#15-load-testing-guide)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Platform Overview

### What is This Platform?

The **Sathapana Bank Lucky Draw Platform** is a full-stack web application that enables Sathapana Bank (Cambodia) to run promotional lucky draw campaigns. Customers earn entries/tickets through qualifying banking transactions (deposits, transfers, account openings) and have a chance to win prizes like cars, electronics, gold, and cash.

### Key Features

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM FEATURES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CUSTOMER FEATURES                ADMIN FEATURES                 │
│  ─────────────────                ──────────────                  │
│  • Browse campaigns               • Create/edit campaigns        │
│  • Earn entries                   • Execute draws                 │
│  • Track progress                 • Manage winners                │
│  • View winners                   • View analytics                │
│  • Check eligibility              • User management               │
│                                   • Audit logs                    │
│                                                                  │
│  SECURITY FEATURES                INFRASTRUCTURE                  │
│  ─────────────────                ──────────────                  │
│  • JWT authentication             • Docker containers             │
│  • Role-based access              • PostgreSQL database           │
│  • Input validation               • Redis caching                 │
│  • Rate limiting                  • CI/CD pipeline                │
│  • Audit logging                  • Load testing                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works (High-Level)

```
1. Admin creates a campaign (e.g., "Open Smart Savings, win a car!")
2. Customer opens qualifying account → Earns 5 entries
3. Customer makes deposits → Earns 1 entry per $150 deposited
4. On draw day, admin executes cryptographic draw
5. Winners are randomly selected based on entry weights
6. Winners are contacted and prizes are fulfilled
```

---

## 2. System Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Web Browser  │    │  Mobile App  │    │  Feature Phone USSD  │  │
│  │  (Next.js)    │    │  (React Native)│   │  (*123#)             │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
└─────────┼───────────────────┼───────────────────────┼───────────────┘
          │                   │                       │
          │    HTTP/HTTPS     │     HTTP/HTTPS        │    USSD/SMS
          ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API LAYER (Express.js)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    MIDDLEWARE STACK                             │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │ Helmet  │ │  CORS   │ │ Rate    │ │  Auth   │ │  Log    │ │ │
│  │  │ Security│ │ Cross-  │ │ Limit   │ │  JWT    │ │ Winston │ │ │
│  │  │ Headers │ │ Origin  │ │ 1000/15m│ │ Verify  │ │ Morgan  │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     API ROUTES                                  │ │
│  │  ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐      │ │
│  │  │  Auth  │ │ Campaign │ │ Entry  │ │ Draw │ │ Winner │      │ │
│  │  │  /auth │ │/campaigns│ │/entries│ │/draws│ │/winners│      │ │
│  │  └────────┘ └──────────┘ └────────┘ └──────┘ └────────┘      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SERVICE LAYER                                   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Campaign    │  │  Entry       │  │  Draw        │              │
│  │  Service     │  │  Service     │  │  Engine      │              │
│  │              │  │              │  │  (CSPRNG)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐              │
│  │  Prize       │  │  Winner      │  │  Notification│              │
│  │  Service     │  │  Service     │  │  Service     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │  Redis       │  │  File        │              │
│  │  Database    │  │  Cache       │  │  Storage     │              │
│  │              │  │              │  │              │              │
│  │  • Campaigns │  │  • Sessions  │  │  • Documents │              │
│  │  • Entries   │  │  • Cache     │  │  • Images    │              │
│  │  • Draws     │  │  • Rate Limit│  │  • Reports   │              │
│  │  • Winners   │  │              │  │              │              │
│  │  • Users     │  │              │  │              │              │
│  │  • Audit Log │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Request Flow Example

```
Customer clicks "Join Campaign" on frontend:

1. Browser sends POST /api/v1/entries with JWT token
2. Express receives request
3. Helmet adds security headers
4. CORS validates origin
5. Rate limiter checks request count
6. Auth middleware verifies JWT token
7. Validation middleware checks input data
8. Entry service processes the request
9. Prisma ORM generates SQL query
10. PostgreSQL executes query
11. Response travels back through middleware stack
12. Browser receives JSON response
13. React updates UI with new entry count
```

---

## 3. Technology Stack

### Backend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | 18+ |
| **Express.js** | Web framework | 4.18 |
| **TypeScript** | Type safety | 5.3 |
| **Prisma** | ORM (Object-Relational Mapping) | 5.8 |
| **PostgreSQL** | Primary database | 15 |
| **Redis** | Caching & session storage | 7 |
| **JWT** | Authentication tokens | 9.0 |
| **Zod** | Input validation | 3.22 |
| **Winston** | Logging | 3.19 |
| **bcryptjs** | Password hashing | 2.4 |

### Frontend Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React framework (SSR/SSG) | 14.1 |
| **React** | UI library | 18.2 |
| **TypeScript** | Type safety | 5.3 |
| **Tailwind CSS** | Utility-first CSS | 3.4 |
| **Zustand** | State management | 4.4 |
| **Axios** | HTTP client | 1.6 |
| **React Hot Toast** | Notifications | 2.4 |

### Infrastructure Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Docker** | Containerization | 24+ |
| **Docker Compose** | Multi-container orchestration | 3.8 |
| **GitHub Actions** | CI/CD pipeline | Latest |
| **k6** | Load testing | Latest |
| **Cypress** | E2E testing | 13.6 |
| **OWASP ZAP** | Security scanning | Latest |

---

## 4. Project Structure

```
sathapana-luckydraw/
│
├── backend/                          # Express.js API Server
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (8 tables)
│   │   └── seed.ts                  # Seed data for testing
│   ├── src/
│   │   ├── config/
│   │   │   ├── index.ts            # Environment config
│   │   │   ├── database.ts         # Prisma client
│   │   │   ├── redis.ts            # Redis client
│   │   │   └── logger.ts           # Winston logger
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT authentication
│   │   │   ├── validate.ts         # Zod validation
│   │   │   ├── errorHandler.ts     # Error handling
│   │   │   ├── cache.ts            # Redis caching
│   │   │   ├── sanitization.ts     # Input sanitization
│   │   │   └── securityAudit.ts    # Security logging
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # /api/v1/auth/*
│   │   │   ├── campaign.routes.ts  # /api/v1/campaigns/*
│   │   │   ├── entry.routes.ts     # /api/v1/entries/*
│   │   │   ├── draw.routes.ts      # /api/v1/draws/*
│   │   │   ├── prize.routes.ts     # /api/v1/prizes/*
│   │   │   ├── winner.routes.ts    # /api/v1/winners/*
│   │   │   └── admin.routes.ts     # /api/v1/admin/*
│   │   ├── services/
│   │   │   ├── drawEngine.ts       # Cryptographic draw logic
│   │   │   ├── notification.ts     # SMS/Email/Push
│   │   │   ├── messageQueue.ts     # Async job queue
│   │   │   └── healthCheck.ts      # Health monitoring
│   │   ├── validations/
│   │   │   ├── auth.validation.ts  # Auth schemas
│   │   │   ├── campaign.validation.ts
│   │   │   ├── entry.validation.ts
│   │   │   ├── draw.validation.ts
│   │   │   └── index.ts            # Export all schemas
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces
│   │   ├── utils/
│   │   │   └── apiResponse.ts      # Response helpers
│   │   └── server.ts               # Main server file
│   ├── tests/
│   │   ├── unit/                   # Unit tests (127 tests)
│   │   └── integration/            # Integration tests
│   ├── loadtests/
│   │   ├── smoke.js                # k6 smoke test
│   │   ├── stress.js               # k6 stress test
│   │   └── draw-load.js            # k6 draw test
│   ├── security/
│   │   ├── owasp-zap.yml           # ZAP config
│   │   └── scan.sh                 # Security scan script
│   ├── Dockerfile                  # Multi-stage build
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                        # Next.js Application
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home page
│   │   ├── globals.css             # Global styles
│   │   ├── login/page.tsx          # Login page
│   │   ├── register/page.tsx       # Registration page
│   │   ├── dashboard/page.tsx      # Customer dashboard
│   │   ├── campaigns/
│   │   │   ├── page.tsx            # Campaign list
│   │   │   └── [id]/page.tsx       # Campaign detail
│   │   └── admin/
│   │       ├── page.tsx            # Admin dashboard
│   │       ├── campaigns/page.tsx  # Campaign management
│   │       ├── draws/page.tsx      # Draw execution
│   │       └── winners/page.tsx    # Winner management
│   ├── lib/
│   │   ├── api.ts                  # Axios API client
│   │   ├── store.ts                # Zustand state
│   │   └── utils.ts                # Utility functions
│   ├── Dockerfile                  # Multi-stage build
│   └── package.json
│
├── cypress/                         # E2E Tests
│   ├── e2e/
│   │   ├── auth.cy.ts             # Auth tests
│   │   ├── campaigns.cy.ts        # Campaign tests
│   │   ├── draw.cy.ts             # Draw tests
│   │   ├── dashboard.cy.ts        # Dashboard tests
│   │   └── admin.cy.ts            # Admin tests
│   ├── fixtures/                   # Test data
│   └── support/                    # Cypress support
│
├── .github/workflows/
│   └── ci.yml                      # CI/CD pipeline
│
├── docker-compose.yml              # Docker orchestration
├── SPEC.md                         # Project specification
├── SECURITY.md                     # Security documentation
├── SECURITY_POLICY.md              # Security policy
└── README.md                       # Project readme
```

---

## 5. Phase 1: Authentication Flow

### Overview

The authentication system provides secure user registration and login using JWT (JSON Web Tokens) with role-based access control (RBAC).

### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐  │
│  │ User    │────▶│ Frontend│────▶│ Backend │────▶│Database │  │
│  │ Browser │     │ Next.js │     │ Express │     │PostgreSQL│  │
│  └─────────┘     └─────────┘     └─────────┘     └─────────┘  │
│                                                                  │
│  1. User fills registration form                                │
│     POST /api/v1/auth/register                                  │
│     { email, password, firstName, lastName, phone }             │
│                          │                                       │
│                          ▼                                       │
│  2. Backend validates input (Zod schema)                        │
│     - Email format valid? ✓                                      │
│     - Password strong? ✓ (8+ chars, mixed case, numbers)        │
│     - Name not empty? ✓                                         │
│                          │                                       │
│                          ▼                                       │
│  3. Check if email already exists                               │
│     SELECT * FROM users WHERE email = ?                         │
│     - If exists → Return 409 "Email already registered"         │
│     - If not exists → Continue                                  │
│                          │                                       │
│                          ▼                                       │
│  4. Hash password with bcrypt (12 rounds)                       │
│     password → $2a$12$LJ3m4ys3Lg...                            │
│                          │                                       │
│                          ▼                                       │
│  5. Create user in database                                     │
│     INSERT INTO users (...) VALUES (...)                        │
│                          │                                       │
│                          ▼                                       │
│  6. Generate JWT token                                          │
│     { userId, email, role } → signed with secret                │
│                          │                                       │
│                          ▼                                       │
│  7. Return response                                             │
│     { user: { id, email, firstName, role }, token: "eyJ..." }  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       LOGIN FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: User submits credentials                               │
│  ─────────────────────────────────                               │
│  POST /api/v1/auth/login                                        │
│  { email: "user@test.com", password: "MyPass123" }             │
│                          │                                       │
│                          ▼                                       │
│  Step 2: Find user by email                                     │
│  ─────────────────────────────                                   │
│  SELECT * FROM users WHERE email = 'user@test.com'             │
│  - If not found → Return 401 "Invalid credentials"             │
│                          │                                       │
│                          ▼                                       │
│  Step 3: Verify password                                        │
│  ─────────────────────────                                       │
│  bcrypt.compare(password, hashedPassword)                        │
│  - If mismatch → Return 401 "Invalid credentials"              │
│                          │                                       │
│                          ▼                                       │
│  Step 4: Check if account is active                             │
│  ─────────────────────────────────                               │
│  if (!user.isActive) → Return 403 "Account deactivated"        │
│                          │                                       │
│                          ▼                                       │
│  Step 5: Update last login timestamp                            │
│  ────────────────────────────────────                            │
│  UPDATE users SET last_login_at = NOW() WHERE id = ?           │
│                          │                                       │
│                          ▼                                       │
│  Step 6: Generate JWT token                                     │
│  ─────────────────────────────                                   │
│  Payload: { userId, email, role }                               │
│  Secret: process.env.JWT_SECRET                                 │
│  Expires: 24 hours                                              │
│                          │                                       │
│                          ▼                                       │
│  Step 7: Store token in localStorage (frontend)                 │
│  ──────────────────────────────────────────────                  │
│  localStorage.setItem('token', token)                           │
│  localStorage.setItem('user', JSON.stringify(user))             │
│                          │                                       │
│                          ▼                                       │
│  Step 8: Redirect to dashboard                                  │
│  ──────────────────────────────                                  │
│  window.location.href = '/dashboard'                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "user-123",
    "email": "user@test.com",
    "role": "SUPER_ADMIN",
    "iat": 1704835200,
    "exp": 1704921600
  },
  "signature": "abc123..."
}
```

### Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLE PERMISSIONS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Role                │ Permissions                              │
│  ────────────────────┼───────────────────────────────────────── │
│  SUPER_ADMIN         │ • Full access to all features            │
│                      │ • User management                        │
│                      │ • System configuration                   │
│                      │ • Execute draws                          │
│                      │                                           │
│  CAMPAIGN_MANAGER    │ • Create/edit campaigns                  │
│                      │ • Activate/pause/close campaigns         │
│                      │ • View campaign statistics               │
│                      │                                           │
│  DRAW_OPERATOR       │ • Execute draws (with approval)          │
│                      │ • View draw results                      │
│                      │ • Add witnesses                          │
│                      │                                           │
│  PRIZE_COORDINATOR   │ • Manage prizes                          │
│                      │ • Track fulfillment                      │
│                      │ • Update winner status                   │
│                      │                                           │
│  COMPLIANCE_OFFICER  │ • View audit logs                        │
│                      │ • Generate reports                       │
│                      │ • View all data (read-only)              │
│                      │                                           │
│  READ_ONLY           │ • View dashboards                        │
│                      │ • View reports                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Middleware Chain

```typescript
// Request flows through these middleware in order:

app.use('/api/v1/auth', authLimiter, authRoutes);
//                       │
//                       ▼
//  1. Rate Limiter (20 requests/15 min)
//     - Prevents brute force attacks
//     - Returns 429 if limit exceeded
//                       │
//                       ▼
//  2. Input Sanitization
//     - Removes malicious characters
//     - Prevents XSS attacks
//                       │
//                       ▼
//  3. Validation (Zod)
//     - Validates email format
//     - Validates password strength
//     - Returns 400 if invalid
//                       │
//                       ▼
//  4. Route Handler
//     - Processes the request
//     - Returns response
```

---

## 6. Phase 2: Campaign Management Flow

### Campaign Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMPAIGN LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐                                                   │
│  │  DRAFT   │  Campaign created, not visible to customers       │
│  └────┬─────┘                                                   │
│       │                                                          │
│       │ Admin clicks "Activate"                                 │
│       ▼                                                          │
│  ┌──────────┐                                                   │
│  │ ACTIVE   │  Customers can earn entries                       │
│  └────┬─────┘                                                   │
│       │                                                          │
│       ├──▶ Admin clicks "Pause"                                 │
│       │    ┌──────────┐                                         │
│       └───▶│ PAUSED   │  Entry earning suspended                │
│            └────┬─────┘                                         │
│                 │                                                │
│                 │ Admin clicks "Resume"                          │
│                 └──▶ Back to ACTIVE                              │
│                                                                  │
│       │                                                          │
│       │ Draw day arrives                                         │
│       ▼                                                          │
│  ┌──────────┐                                                   │
│  │ DRAW_DAY │  Draw execution window                            │
│  └────┬─────┘                                                   │
│       │                                                          │
│       │ Draw executed                                            │
│       ▼                                                          │
│  ┌──────────┐                                                   │
│  │ DRAWN    │  Winners selected                                 │
│  └────┬─────┘                                                   │
│       │                                                          │
│       │ All prizes fulfilled                                     │
│       ▼                                                          │
│  ┌──────────┐                                                   │
│  │ CLOSED   │  Campaign archived                                │
│  └──────────┘                                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Campaign Creation Flow

```
Step 1: Admin navigates to Admin Dashboard
        └── Click "Create Campaign" button

Step 2: Campaign form appears with fields:
        ├── Name: "Smart Savings Lucky Draw 2025"
        ├── Description: "Open Smart Savings, win a Mazda EZ-6!"
        ├── Type: ACCOUNT_OPENING (dropdown)
        ├── Start Date: 2025-01-01
        ├── End Date: 2025-12-31
        ├── Draw Date: 2025-12-31
        ├── Total Budget: 500000 USD
        └── Entry Rules (add multiple):
            ├── Rule 1: Account opened → 5 entries
            └── Rule 2: Every $150 deposit → 1 entry

Step 3: Frontend sends API request
        POST /api/v1/campaigns
        Headers: { Authorization: "Bearer <token>" }
        Body: { name, description, type, dates, rules }

Step 4: Backend processes request
        ├── Validate input (Zod schema)
        ├── Check user has CAMPAIGN_MANAGER or SUPER_ADMIN role
        ├── Create campaign in database
        ├── Create audit log entry
        └── Return created campaign

Step 5: Frontend updates UI
        ├── Show success toast: "Campaign created successfully"
        └── Redirect to campaign list
```

### Campaign API Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                 CAMPAIGN API ENDPOINTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET    /api/v1/campaigns              List all campaigns       │
│         Query params: ?page=1&limit=10&status=ACTIVE            │
│                                                                  │
│  GET    /api/v1/campaigns/:id          Get campaign details     │
│         Response: { campaign, prizes, stats }                   │
│                                                                  │
│  POST   /api/v1/campaigns              Create new campaign      │
│         Body: { name, description, type, dates, rules }         │
│         Auth: CAMPAIGN_MANAGER, SUPER_ADMIN                     │
│                                                                  │
│  PUT    /api/v1/campaigns/:id          Update campaign          │
│         Body: { name?, description?, ... }                      │
│         Auth: CAMPAIGN_MANAGER, SUPER_ADMIN                     │
│         Note: Only DRAFT or SCHEDULED campaigns                 │
│                                                                  │
│  DELETE /api/v1/campaigns/:id          Delete campaign          │
│         Auth: SUPER_ADMIN only                                  │
│         Note: Only DRAFT campaigns                              │
│                                                                  │
│  POST   /api/v1/campaigns/:id/activate Activate campaign       │
│         Auth: CAMPAIGN_MANAGER, SUPER_ADMIN                     │
│                                                                  │
│  POST   /api/v1/campaigns/:id/pause    Pause campaign           │
│         Auth: CAMPAIGN_MANAGER, SUPER_ADMIN                     │
│                                                                  │
│  POST   /api/v1/campaigns/:id/close    Close campaign           │
│         Auth: CAMPAIGN_MANAGER, SUPER_ADMIN                     │
│                                                                  │
│  GET    /api/v1/campaigns/:id/stats    Get campaign stats       │
│         Response: { totalEntries, uniqueParticipants, ... }     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Phase 3: Entry/Ticket Earning Flow

### How Entries Are Earned

```
┌─────────────────────────────────────────────────────────────────┐
│                 ENTRY EARNING MECHANISMS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ACCOUNT OPENING                                              │
│     ─────────────────                                            │
│     Customer opens Smart Savings Account                        │
│     └── System detects new account                              │
│         └── Awards 5 entries automatically                      │
│                                                                  │
│  2. DEPOSIT/TOP-UP                                               │
│     ─────────────────                                            │
│     Customer deposits $150 to Smart Savings                     │
│     └── System detects qualifying deposit                       │
│         └── Awards 1 entry per $150                             │
│             (Deposit $450 = 3 entries)                          │
│                                                                  │
│  3. MOBILE TRANSACTION                                           │
│     ─────────────────────                                        │
│     Customer makes 5 mobile transfers                           │
│     └── System counts qualifying transactions                   │
│         └── Awards 1 entry per 5 transactions                   │
│                                                                  │
│  4. REFERRAL                                                     │
│     ─────────                                                    │
│     Customer refers friend who opens account                    │
│     └── System verifies referral                                │
│         └── Awards 3 entries                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Entry Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY REGISTRATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Customer action triggers entry                         │
│  ────────────────────────────────────────                        │
│  Example: Customer deposits $300 to Smart Savings               │
│                                                                  │
│  Step 2: Core banking system sends webhook                      │
│  ────────────────────────────────────────────                    │
│  POST /api/v1/entries                                           │
│  {                                                              │
│    "customerId": "CUST-001",                                   │
│    "campaignId": "CAMP-001",                                   │
│    "accountId": "ACC-123456",                                  │
│    "entryType": "DEPOSIT",                                     │
│    "triggerTransactionId": "TXN-789",                          │
│    "metadata": { "amount": 300 }                               │
│  }                                                              │
│                          │                                       │
│                          ▼                                       │
│  Step 3: Backend validates request                              │
│  ─────────────────────────────────                               │
│  ├── Check campaign exists and is ACTIVE                        │
│  ├── Check campaign dates are valid                             │
│  ├── Check customer is eligible                                 │
│  └── Check for duplicate transaction                            │
│                          │                                       │
│                          ▼                                       │
│  Step 4: Calculate entries earned                               │
│  ─────────────────────────────────                               │
│  Entry Rules:                                                   │
│  - Trigger: DEPOSIT                                             │
│  - Amount increment: $150                                       │
│  - Entries per increment: 1                                     │
│                                                                  │
│  Calculation: $300 / $150 = 2 entries                          │
│                          │                                       │
│                          ▼                                       │
│  Step 5: Create entry record                                    │
│  ─────────────────────────────                                   │
│  INSERT INTO customer_entries (                                 │
│    customer_id, campaign_id, entry_type,                        │
│    entries_earned, trigger_transaction_id,                      │
│    cumulative_entries, verified                                 │
│  ) VALUES (...)                                                 │
│                          │                                       │
│                          ▼                                       │
│  Step 6: Send notification                                      │
│  ────────────────────────────                                    │
│  SMS: "🎉 You earned 2 entries! Total: 15 entries"            │
│  Push: "Great! +2 entries for your $300 deposit"              │
│                          │                                       │
│                          ▼                                       │
│  Step 7: Return response                                        │
│  ──────────────────────────                                      │
│  {                                                              │
│    "success": true,                                             │
│    "data": {                                                    │
│      "entryId": "ENTRY-001",                                   │
│      "entriesEarned": 2,                                        │
│      "cumulativeEntries": 15                                    │
│    }                                                            │
│  }                                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Duplicate Prevention

```
┌─────────────────────────────────────────────────────────────────┐
│                    DUPLICATE PREVENTION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Database Constraint:                                           │
│  UNIQUE(campaign_id, customer_id, trigger_transaction_id)       │
│                                                                  │
│  Flow:                                                          │
│  1. Receive entry request                                       │
│  2. Check: SELECT * FROM customer_entries                       │
│     WHERE campaign_id = ?                                       │
│     AND customer_id = ?                                         │
│     AND trigger_transaction_id = ?                              │
│  3. If found → Return 409 "Entry already registered"           │
│  4. If not found → Create new entry                            │
│                                                                  │
│  Additional Checks:                                             │
│  - Max entries per customer limit                              │
│  - Rate limiting (entries per minute)                          │
│  - Transaction amount validation                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Entry Tracking Database Schema

```sql
CREATE TABLE customer_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(50) NOT NULL,
    campaign_id UUID NOT NULL REFERENCES campaigns(id),
    account_id VARCHAR(50),
    entry_type VARCHAR(50) NOT NULL,          -- DEPOSIT, TRANSFER, etc.
    entries_earned INTEGER NOT NULL,           -- How many entries earned
    cumulative_entries INTEGER NOT NULL,       -- Total entries for this customer
    trigger_transaction_id VARCHAR(100),       -- Unique transaction reference
    entry_date TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT TRUE,
    verification_source VARCHAR(100),          -- SYSTEM, MANUAL, API
    metadata JSONB,                           -- Additional data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicates
    UNIQUE(campaign_id, customer_id, trigger_transaction_id)
);

-- Indexes for fast queries
CREATE INDEX idx_entries_customer ON customer_entries(customer_id);
CREATE INDEX idx_entries_campaign ON customer_entries(campaign_id);
CREATE INDEX idx_entries_date ON customer_entries(entry_date);
```

---

## 8. Phase 4: Draw Execution Flow

### The Draw Engine

The draw engine is the core of the platform. It uses **cryptographically secure random number generation (CSPRNG)** to ensure fair and auditable winner selection.

### Draw Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRAW EXECUTION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASE 1: PRE-DRAW VALIDATION (2-3 seconds)               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  1. Verify campaign status is ACTIVE or DRAW_DAY        │  │
│  │  2. Verify draw date has been reached                    │  │
│  │  3. Verify all entries are verified                     │  │
│  │  4. Verify prizes are available                         │  │
│  │  5. Verify authorized personnel are present             │  │
│  │                                                          │  │
│  │  If any check fails → Abort with error                   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASE 2: PARTICIPANT SNAPSHOT (5-10 seconds)             │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  1. Query all customers with entries for this campaign  │  │
│  │  2. Group entries by customer                           │  │
│  │  3. Calculate total entries per customer                │  │
│  │  4. Calculate weights (entries / total)                 │  │
│  │  5. Create snapshot record                              │  │
│  │                                                          │  │
│  │  Example:                                               │  │
│  │  ┌────────────┬───────────┬────────┐                    │  │
│  │  │ Customer   │ Entries   │ Weight │                    │  │
│  │  ├────────────┼───────────┼────────┤                    │  │
│  │  │ Customer A │ 50        │ 0.50   │                    │  │
│  │  │ Customer B │ 30        │ 0.30   │                    │  │
│  │  │ Customer C │ 20        │ 0.20   │                    │  │
│  │  ├────────────┼───────────┼────────┤                    │  │
│  │  │ TOTAL      │ 100       │ 1.00   │                    │  │
│  │  └────────────┴───────────┴────────┘                    │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASE 3: RANDOM SELECTION (1-2 seconds)                  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  1. Generate cryptographic seed                         │  │
│  │     seed = crypto.randomBytes(32).toString('hex')       │  │
│  │     Result: "a1b2c3d4e5f6..." (64 char hex string)    │  │
│  │                                                          │  │
│  │  2. Use seed to initialize random generator             │  │
│  │     This ensures deterministic results                  │  │
│  │     (same seed = same winners)                          │  │
│  │                                                          │  │
│  │  3. Execute weighted random selection                   │  │
│  │     - Customer A has 50% chance (50/100 entries)       │  │
│  │     - Customer B has 30% chance (30/100 entries)       │  │
│  │     - Customer C has 20% chance (20/100 entries)       │  │
│  │                                                          │  │
│  │  4. Select winners for each prize tier                  │  │
│  │     - Winner 1 (Car) → Selected                        │  │
│  │     - Remove winner from pool (no replacement)         │  │
│  │     - Winner 2 (Phone) → Selected from remaining       │  │
│  │     - Continue for all prizes                          │  │
│  │                                                          │  │
│  │  5. Select alternates (backup winners)                  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASE 4: AUDIT & PERSISTENCE (2-3 seconds)               │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  1. Generate audit hash (SHA-256)                       │  │
│  │     hash = SHA256(seed + winners + timestamp)          │  │
│  │                                                          │  │
│  │  2. Save draw result to database                        │  │
│  │     INSERT INTO draw_results (...)                      │  │
│  │                                                          │  │
│  │  3. Save winners to database                            │  │
│  │     INSERT INTO draw_winners (...)                      │  │
│  │                                                          │  │
│  │  4. Create audit log entry                              │  │
│  │     INSERT INTO audit_log (...)                         │  │
│  │                                                          │  │
│  │  5. Send notifications to winners                       │  │
│  │     SMS: "🎉 Congratulations! You won a Mazda EZ-6!"  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASE 5: RESULT VERIFICATION (manual)                    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  1. Admin reviews draw results                          │  │
│  │  2. Witnesses confirm participation                     │  │
│  │  3. Results can be independently verified:              │  │
│  │     - Use seed to replay draw                           │  │
│  │     - Verify hash matches                               │  │
│  │     - Confirm winner eligibility                        │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Weighted Random Selection Algorithm

```typescript
// Simplified draw engine algorithm

function weightedRandomSelection(
  participants: Participant[],
  numberOfWinners: number,
  allowMultipleWins: boolean
): Winner[] {
  
  // Step 1: Calculate total entries
  const totalEntries = participants.reduce(
    (sum, p) => sum + p.totalEntries, 0
  );
  
  // Step 2: Calculate weights
  const weightedParticipants = participants.map(p => ({
    ...p,
    weight: p.totalEntries / totalEntries
  }));
  
  // Step 3: Select winners
  const winners: Winner[] = [];
  const availableParticipants = [...weightedParticipants];
  
  for (let i = 0; i < numberOfWinners; i++) {
    // Generate random number between 0 and 1
    const randomValue = crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF;
    
    // Find winner based on cumulative weight
    let cumulativeWeight = 0;
    for (const participant of availableParticipants) {
      cumulativeWeight += participant.weight;
      if (randomValue <= cumulativeWeight) {
        winners.push(participant);
        
        // Remove from pool (unless multiple wins allowed)
        if (!allowMultipleWins) {
          const index = availableParticipants.indexOf(participant);
          availableParticipants.splice(index, 1);
          
          // Recalculate weights
          const newTotal = availableParticipants.reduce(
            (sum, p) => sum + p.totalEntries, 0
          );
          availableParticipants.forEach(p => {
            p.weight = p.totalEntries / newTotal;
          });
        }
        break;
      }
    }
  }
  
  return winners;
}
```

### Draw API Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                    DRAW API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST   /api/v1/draws/execute                                  │
│         Execute a draw for a campaign                           │
│         Body: {                                                 │
│           campaignId: "CAMP-001",                               │
│           numberOfWinners: 3,                                   │
│           numberOfAlternates: 5,                                │
│           allowMultipleWins: false                              │
│         }                                                       │
│         Auth: DRAW_OPERATOR, SUPER_ADMIN                        │
│         Rate Limit: 5 per hour                                  │
│                                                                  │
│  GET    /api/v1/draws                                          │
│         List all draws                                          │
│         Query: ?page=1&limit=10&campaignId=CAMP-001            │
│                                                                  │
│  GET    /api/v1/draws/:id                                      │
│         Get draw details with winners                           │
│         Response: { draw, winners, alternates }                 │
│                                                                  │
│  POST   /api/v1/draws/:id/witness                              │
│         Add witness to draw                                     │
│         Auth: Any authenticated user                            │
│                                                                  │
│  POST   /api/v1/draws/:id/verify                               │
│         Verify draw integrity                                   │
│         Response: { verified: true, hash: "..." }               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Phase 5: Prize & Winner Management Flow

### Prize Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRIZE CATEGORIES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MAJOR PRIZES (Tier 1)                                          │
│  ──────────────────────                                         │
│  • Vehicles: Cars, motorcycles, e-bikes                        │
│  • Value: $5,000 - $50,000                                     │
│  • Quantity: 1-5 per campaign                                  │
│                                                                  │
│  SECONDARY PRIZES (Tier 2)                                      │
│  ────────────────────────                                       │
│  • Electronics: Smartphones, tablets, watches                  │
│  • Value: $200 - $2,000                                        │
│  • Quantity: 5-20 per campaign                                 │
│                                                                  │
│  MINOR PRIZES (Tier 3)                                          │
│  ──────────────────────                                         │
│  • Gift cards, vouchers, merchandise                          │
│  • Value: $20 - $200                                           │
│  • Quantity: 50-500 per campaign                               │
│                                                                  │
│  SPECIAL PRIZES                                                 │
│  ───────────────                                                │
│  • Gold bars, jewelry                                          │
│  • Travel packages                                             │
│  • Cash prizes                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Winner Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    WINNER MANAGEMENT FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Draw completes, winners selected                       │
│  ──────────────────────────────────────────                      │
│  Status: "SELECTED"                                            │
│  Action: System sends notification                              │
│                                                                  │
│  Step 2: Winner verification                                    │
│  ──────────────────────────────                                  │
│  - Check winner's account is active                            │
│  - Verify KYC compliance                                       │
│  - Check for fraud flags                                       │
│  Status: "VERIFIED" or "REJECTED"                              │
│                                                                  │
│  Step 3: Contact winner                                         │
│  ────────────────────────                                        │
│  - Send SMS with instructions                                  │
│  - Send email with prize details                               │
│  - Call if no response in 3 days                               │
│  Status: "CONTACTED"                                           │
│                                                                  │
│  Step 4: Winner acceptance                                      │
│  ─────────────────────────                                       │
│  - Winner confirms acceptance                                  │
│  - Winner chooses: physical prize or cash equivalent           │
│  - Winner provides required documents                          │
│  Status: "ACCEPTED"                                            │
│                                                                  │
│  Step 5: Prize fulfillment                                      │
│  ─────────────────────────                                       │
│  - Arrange delivery/ceremony                                   │
│  - Transfer cash prizes to account                             │
│  - Get signed acknowledgment                                  │
│  Status: "FULFILLED"                                           │
│                                                                  │
│  Step 6: Public announcement                                    │
│  ───────────────────────────                                     │
│  - Announce winner on platform (with consent)                  │
│  - Update campaign statistics                                  │
│  - Archive campaign if all prizes fulfilled                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Winner Status Transitions

```
SELECTED ──▶ VERIFIED ──▶ CONTACTED ──▶ ACCEPTED ──▶ FULFILLED
    │            │            │            │
    │            │            │            └──▶ DECLINED
    │            │            └──▶ NO_RESPONSE
    │            └──▶ REJECTED
    └──▶ REPLACED (by alternate)
```

---

## 10. Phase 6: Admin Dashboard Flow

### Dashboard Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  STATISTICS CARDS                                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ Active   │ │ Total    │ │ Total    │ │ Total    │   │  │
│  │  │ Campaigns│ │ Entries  │ │ Winners  │ │ Revenue  │   │  │
│  │  │    3     │ │  45,230  │ │    12    │ │ $500,000 │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CAMPAIGN PERFORMANCE CHART                               │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Entries                                            │  │  │
│  │  │    ▲                                               │  │  │
│  │  │  50K│        ╭────────────╮                        │  │  │
│  │  │    │      ╭─╯            ╰─╮                      │  │  │
│  │  │  25K│   ╭─╯                ╰─╮                    │  │  │
│  │  │    │ ╭─╯                    ╰─╮                  │  │  │
│  │  │    └─┴────────────────────────┴────▶ Time         │  │  │
│  │  │       Jan  Feb  Mar  Apr  May  Jun               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────┐  ┌────────────────────────────────┐│
│  │  RECENT ENTRIES         │  │  UPCOMING DRAWS                ││
│  │  ──────────────         │  │  ──────────────                ││
│  │  • CUST-001: +1 entry  │  │  • Smart Savings: Sep 15      ││
│  │  • CUST-002: +3 entry  │  │  • Mobile Banking: Oct 1      ││
│  │  • CUST-003: +1 entry  │  │  • Referral Program: Nov 1    ││
│  │  • CUST-004: +2 entry  │  │                                ││
│  └────────────────────────┘  └────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Admin API Endpoints

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN API ENDPOINTS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  GET    /api/v1/admin/dashboard                                │
│         Get dashboard statistics                                │
│         Response: { campaigns, entries, winners, revenue }      │
│                                                                  │
│  GET    /api/v1/admin/reports/campaign-performance             │
│         Get campaign performance report                         │
│                                                                  │
│  GET    /api/v1/admin/reports/winner-fulfillment               │
│         Get winner fulfillment report                           │
│                                                                  │
│  GET    /api/v1/admin/audit-logs                               │
│         Get audit logs                                          │
│         Query: ?page=1&entityType=CAMPAIGN                     │
│                                                                  │
│  GET    /api/v1/admin/users                                    │
│         List all users                                          │
│         Query: ?page=1&role=SUPER_ADMIN                        │
│                                                                  │
│  PUT    /api/v1/admin/users/:id/role                           │
│         Update user role                                        │
│         Body: { role: "CAMPAIGN_MANAGER" }                     │
│                                                                  │
│  PUT    /api/v1/admin/users/:id/status                         │
│         Activate/deactivate user                                │
│         Body: { isActive: false }                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Frontend-Backend Communication

### How Frontend Communicates with Backend

The frontend (Next.js) communicates with the backend (Express.js) through a RESTful API using HTTP requests.

### API Client Setup (frontend/lib/api.ts)

```typescript
// The API client is configured with Axios

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// REQUEST INTERCEPTOR: Automatically adds auth token to every request
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// RESPONSE INTERCEPTOR: Handles errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If 401 Unauthorized, redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### API Call Examples

```
┌─────────────────────────────────────────────────────────────────┐
│                    API CALL EXAMPLES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. LOGIN                                                        │
│  ─────────                                                       │
│  Frontend:                                                      │
│  const response = await authApi.login(email, password);         │
│                                                                  │
│  HTTP Request:                                                  │
│  POST http://localhost:3000/api/v1/auth/login                   │
│  Content-Type: application/json                                 │
│  { "email": "user@test.com", "password": "Pass123" }          │
│                                                                  │
│  HTTP Response:                                                 │
│  200 OK                                                         │
│  { "success": true, "data": { "user": {...}, "token": "..." }} │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  2. GET CAMPAIGNS                                                │
│  ────────────────                                                │
│  Frontend:                                                      │
│  const response = await campaignApi.list({ status: 'ACTIVE' }); │
│                                                                  │
│  HTTP Request:                                                  │
│  GET http://localhost:3000/api/v1/campaigns?status=ACTIVE       │
│  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...                 │
│                                                                  │
│  HTTP Response:                                                 │
│  200 OK                                                         │
│  { "success": true, "data": [...], "pagination": {...} }       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  3. REGISTER ENTRY                                              │
│  ─────────────────                                               │
│  Frontend:                                                      │
│  const response = await entryApi.register({                     │
│    customerId: 'CUST-001',                                      │
│    campaignId: 'CAMP-001',                                      │
│    entryType: 'DEPOSIT',                                        │
│    triggerTransactionId: 'TXN-123'                              │
│  });                                                            │
│                                                                  │
│  HTTP Request:                                                  │
│  POST http://localhost:3000/api/v1/entries                      │
│  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...                 │
│  Content-Type: application/json                                 │
│  { "customerId": "CUST-001", "campaignId": "CAMP-001", ... }  │
│                                                                  │
│  HTTP Response:                                                 │
│  201 Created                                                    │
│  { "success": true, "data": { "entriesEarned": 2 } }          │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  4. EXECUTE DRAW                                                │
│  ────────────────                                                │
│  Frontend:                                                      │
│  const response = await drawApi.execute({                        │
│    campaignId: 'CAMP-001',                                      │
│    numberOfWinners: 3,                                          │
│    numberOfAlternates: 5                                        │
│  });                                                            │
│                                                                  │
│  HTTP Request:                                                  │
│  POST http://localhost:3000/api/v1/draws/execute                │
│  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...                 │
│  Content-Type: application/json                                 │
│  { "campaignId": "CAMP-001", "numberOfWinners": 3, ... }     │
│                                                                  │
│  HTTP Response:                                                 │
│  200 OK                                                         │
│  {                                                              │
│    "success": true,                                             │
│    "data": {                                                    │
│      "drawId": "DRAW-001",                                     │
│      "winners": [...],                                          │
│      "alternates": [...],                                       │
│      "auditHash": "a1b2c3d4..."                                │
│    }                                                            │
│  }                                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  USER ACTION                                              │  │
│  │  User clicks "Join Campaign" button                       │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REACT STATE                                             │  │
│  │  handleClick() function triggered                        │  │
│  │  setisLoading(true)                                      │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API CALL                                                │  │
│  │  campaignApi.join(campaignId)                            │  │
│  │  └── api.post('/entries', data)                          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  AXIOS REQUEST                                           │  │
│  │  ├── Add Authorization header (interceptor)             │  │
│  │  ├── Serialize body to JSON                             │  │
│  │  └── Send HTTP POST to backend                          │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  EXPRESS SERVER                                          │  │
│  │  ├── Helmet (security headers)                          │  │
│  │  ├── CORS (cross-origin check)                          │  │
│  │  ├── Rate Limiter (request count)                       │  │
│  │  ├── Body Parser (parse JSON)                           │  │
│  │  ├── Sanitization (clean input)                         │  │
│  │  └── Auth Middleware (verify JWT)                        │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ROUTE HANDLER                                           │  │
│  │  entries.routes.ts                                       │  │
│  │  ├── Validate input (Zod)                               │  │
│  │  ├── Check campaign exists                              │  │
│  │  ├── Check customer eligibility                         │  │
│  │  └── Create entry                                       │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PRISMA ORM                                              │  │
│  │  prisma.customerEntry.create({ data: {...} })           │  │
│  │  └── Generates SQL: INSERT INTO customer_entries (...)  │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  POSTGRESQL DATABASE                                     │  │
│  │  Executes INSERT, returns new record                     │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  RESPONSE TRAVELS BACK                                   │  │
│  │  Database → Prisma → Route → Middleware → Axios → React │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REACT STATE UPDATE                                      │  │
│  │  ├── setisLoading(false)                                │  │
│  │  ├── setEntries(newEntries)                             │  │
│  │  └── toast.success("Entry registered!")                 │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI UPDATE                                               │  │
│  │  Component re-renders with new data                      │  │
│  │  User sees updated entry count                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Database Flow

### Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE RELATIONSHIPS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐       ┌──────────────┐       ┌──────────┐        │
│  │  users   │       │  campaigns   │       │  prizes  │        │
│  │----------│       │--------------│       │----------│        │
│  │ id (PK)  │◀──┐   │ id (PK)      │◀──┐   │ id (PK)  │        │
│  │ email    │   │   │ name         │   │   │ camp_id  │────┐   │
│  │ password │   │   │ status       │   │   │ rank     │    │   │
│  │ role     │   │   │ start_date   │   │   │ name     │    │   │
│  │ is_active│   │   │ end_date     │   │   │ quantity │    │   │
│  └──────────┘   │   │ draw_date    │   │   └──────────┘    │   │
│                 │   │ created_by ──│───┘                   │   │
│                 │   └──────────────┘                       │   │
│                 │          │                                │   │
│                 │          │ 1:N                            │   │
│                 │          ▼                                │   │
│                 │   ┌──────────────┐                       │   │
│                 │   │   entries    │                       │   │
│                 │   │--------------│                       │   │
│                 │   │ id (PK)      │                       │   │
│                 ├──▶│ customer_id  │                       │   │
│                 │   │ campaign_id ─│───────────────────────┘   │
│                 │   │ entry_type   │                           │
│                 │   │ entries      │   ┌──────────────┐        │
│                 │   │ txn_id       │   │ draw_results │        │
│                 │   └──────────────┘   │--------------│        │
│                 │                      │ id (PK)      │        │
│                 │                      │ campaign_id ─│──┐     │
│                 │                      │ seed         │  │     │
│                 │                      │ audit_hash   │  │     │
│                 │                      │ executed_by  │  │     │
│                 │                      └──────────────┘  │     │
│                 │                            │           │     │
│                 │                            │ 1:N       │     │
│                 │                            ▼           │     │
│                 │                      ┌──────────────┐  │     │
│                 │                      │ draw_winners │  │     │
│                 │                      │--------------│  │     │
│                 │                      │ id (PK)      │  │     │
│                 │                      │ draw_id ─────│──┘     │
│                 │                      │ customer_id ─│───────▶│
│                 │                      │ prize_id ────│───────▶│
│                 │                      │ status       │        │
│                 │                      └──────────────┘        │
│                 │                                              │
│                 │   ┌──────────────┐                          │
│                 │   │  audit_log   │                          │
│                 │   │--------------│                          │
│                 │   │ id (PK)      │                          │
│                 ├──▶│ entity_type  │                          │
│                 │   │ entity_id    │                          │
│                 │   │ action       │                          │
│                 │   │ performed_by │                          │
│                 │   └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### SQL Query Examples

```sql
-- 1. Get all active campaigns with prize count
SELECT 
    c.id,
    c.name,
    c.status,
    c.start_date,
    c.end_date,
    COUNT(p.id) as prize_count
FROM campaigns c
LEFT JOIN prizes p ON p.campaign_id = c.id
WHERE c.status = 'ACTIVE'
GROUP BY c.id
ORDER BY c.created_at DESC;

-- 2. Get customer's entry summary for a campaign
SELECT 
    customer_id,
    COUNT(*) as total_entries,
    SUM(entries_earned) as total_entries_earned,
    MAX(entry_date) as last_entry_date
FROM customer_entries
WHERE campaign_id = 'CAMP-001'
AND customer_id = 'CUST-001'
GROUP BY customer_id;

-- 3. Get draw results with winners
SELECT 
    dr.id as draw_id,
    dr.draw_date,
    dr.audit_hash,
    dw.customer_id,
    dw.rank,
    p.name as prize_name,
    dw.status as winner_status
FROM draw_results dr
JOIN draw_winners dw ON dw.draw_result_id = dr.id
JOIN prizes p ON p.id = dw.prize_id
WHERE dr.campaign_id = 'CAMP-001'
ORDER BY dw.rank;

-- 4. Get campaign statistics
SELECT 
    c.id,
    c.name,
    COUNT(DISTINCT ce.customer_id) as unique_participants,
    SUM(ce.entries_earned) as total_entries,
    COUNT(DISTINCT dw.id) as total_winners
FROM campaigns c
LEFT JOIN customer_entries ce ON ce.campaign_id = c.id
LEFT JOIN draw_results dr ON dr.campaign_id = c.id
LEFT JOIN draw_winners dw ON dw.draw_result_id = dr.id
WHERE c.id = 'CAMP-001'
GROUP BY c.id;

-- 5. Audit log for a campaign
SELECT 
    al.entity_type,
    al.action,
    al.performed_by,
    al.details,
    al.created_at
FROM audit_log al
WHERE al.entity_type = 'CAMPAIGN'
AND al.entity_id = 'CAMP-001'
ORDER BY al.created_at DESC;
```

---

## 13. Security Flow

### Security Middleware Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY MIDDLEWARE CHAIN                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Incoming Request                                               │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. HELMET - Security Headers                            │   │
│  │    ├── Content-Security-Policy                          │   │
│  │    ├── X-Content-Type-Options: nosniff                 │   │
│  │    ├── X-Frame-Options: DENY                           │   │
│  │    └── Strict-Transport-Security                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 2. CORS - Cross-Origin Resource Sharing                 │   │
│  │    ├── Validate origin against whitelist                │   │
│  │    ├── Allow specific methods (GET, POST, PUT, DELETE) │   │
│  │    └── Allow specific headers                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 3. RATE LIMITER - Request Throttling                    │   │
│  │    ├── Global: 1000 requests/15 minutes                │   │
│  │    ├── Auth: 20 requests/15 minutes                    │   │
│  │    └── Draw: 5 requests/hour                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 4. BODY PARSER - Request Parsing                        │   │
│  │    ├── Parse JSON body                                  │   │
│  │    ├── Limit size to 1MB                                │   │
│  │    └── Reject malformed JSON                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 5. SANITIZATION - Input Cleaning                        │   │
│  │    ├── Remove XSS characters (<, >, &)                 │   │
│  │    ├── Prevent SQL injection patterns                   │   │
│  │    └── Block path traversal (../)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 6. SECURITY AUDIT - Activity Logging                    │   │
│  │    ├── Log authentication attempts                      │   │
│  │    ├── Detect suspicious patterns                       │   │
│  │    └── Block suspicious IPs                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 7. AUTH MIDDLEWARE - JWT Verification                    │   │
│  │    ├── Extract token from Authorization header         │   │
│  │    ├── Verify token signature                          │   │
│  │    ├── Check token expiration                          │   │
│  │    └── Attach user to request                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│       │                                                          │
│       ▼                                                          │
│  Route Handler                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Security Features Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY FEATURES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AUTHENTICATION                                                  │
│  ──────────────                                                  │
│  ✅ JWT tokens with 24h expiration                             │
│  ✅ bcrypt password hashing (12 rounds)                        │
│  ✅ Refresh token rotation                                     │
│  ✅ Account lockout after 5 failed attempts                    │
│                                                                  │
│  AUTHORIZATION                                                   │
│  ─────────────                                                   │
│  ✅ Role-based access control (RBAC)                           │
│  ✅ Route-level permission checks                              │
│  ✅ Resource-level ownership validation                        │
│                                                                  │
│  INPUT VALIDATION                                                │
│  ────────────────                                                │
│  ✅ Zod schema validation                                      │
│  ✅ SQL injection prevention (Prisma ORM)                      │
│  ✅ XSS prevention (sanitization)                              │
│  ✅ CSRF protection (SameSite cookies)                         │
│                                                                  │
│  INFRASTRUCTURE                                                  │
│  ──────────────                                                  │
│  ✅ HTTPS enforcement (Helmet)                                 │
│  ✅ Rate limiting (express-rate-limit)                         │
│  ✅ Request size limits (1MB)                                  │
│  ✅ Security headers (CSP, HSTS, etc.)                        │
│                                                                  │
│  MONITORING                                                      │
│  ──────────                                                      │
│  ✅ Security event logging (Winston)                           │
│  ✅ Audit trail (database)                                     │
│  ✅ Suspicious activity detection                              │
│  ✅ IP blocking                                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Starting & Stopping Servers

### Option 1: Using Docker (Recommended)

Docker is the easiest way to run the entire platform. It automatically sets up PostgreSQL, Redis, the backend, and the frontend.

#### Starting All Services

```bash
# Step 1: Navigate to project root
cd sathapana-luckydraw

# Step 2: Build and start all containers
docker-compose up -d

# Step 3: Wait for services to be healthy (about 30 seconds)
docker-compose ps

# Step 4: Initialize database
docker-compose exec backend npx prisma db push

# Step 5: Seed database with test data
docker-compose exec backend npx prisma db seed

# Step 6: Verify services are running
curl http://localhost:3000/health
```

#### Accessing Services

```
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE URLS (Docker)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend:     http://localhost:3001                             │
│  Backend API:  http://localhost:3000/api/v1                      │
│  Health Check: http://localhost:3000/health                      │
│  PostgreSQL:   localhost:5432                                    │
│  Redis:        localhost:6379                                    │
│                                                                  │
│  Default Login:                                                  │
│  Email: admin@sathapana.com.kh                                  │
│  Password: password123                                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Stopping All Services

```bash
# Stop all containers (preserves data)
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

#### Viewing Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f backend
```

#### Rebuilding After Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

---

### Option 2: Running Without Docker (Manual Setup)

For development or when Docker is not available.

#### Prerequisites

```bash
# Check Node.js version (need 18+)
node --version

# Check PostgreSQL (need 15+)
psql --version

# Check Redis (need 7+)
redis-cli --version
```

#### Starting Backend

```bash
# Step 1: Navigate to backend directory
cd backend

# Step 2: Install dependencies
npm install

# Step 3: Set up environment variables
cp .env.example .env

# Edit .env file with your database credentials:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/luckydraw"
# REDIS_URL="redis://localhost:6379"
# JWT_SECRET="your-secret-key"

# Step 4: Generate Prisma client
npx prisma generate

# Step 5: Push database schema
npx prisma db push

# Step 6: Seed database
npx prisma db seed

# Step 7: Start development server
npm run dev

# Backend will start at http://localhost:3000
```

#### Starting Frontend

```bash
# Step 1: Open new terminal, navigate to frontend
cd frontend

# Step 2: Install dependencies
npm install

# Step 3: Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1" > .env.local

# Step 4: Start development server
npm run dev

# Frontend will start at http://localhost:3000
# (Note: Uses port 3000 by default, change in next.config.js if needed)
```

#### Starting PostgreSQL

```bash
# macOS (Homebrew)
brew services start postgresql@15

# Linux (systemd)
sudo systemctl start postgresql

# Docker only
docker run -d \
  --name postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=luckydraw \
  postgres:15-alpine

# Create database
createdb luckydraw
```

#### Starting Redis

```bash
# macOS (Homebrew)
brew services start redis

# Linux (systemd)
sudo systemctl start redis

# Docker only
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

#### Stopping Services

```bash
# Stop backend (Ctrl+C in terminal)

# Stop PostgreSQL
brew services stop postgresql@15  # macOS
sudo systemctl stop postgresql    # Linux

# Stop Redis
brew services stop redis          # macOS
sudo systemctl stop redis         # Linux
```

---

### Option 3: Production Setup

```bash
# Step 1: Build backend
cd backend
npm run build

# Step 2: Start backend in production mode
NODE_ENV=production npm start

# Step 3: Build frontend
cd frontend
npm run build

# Step 4: Start frontend in production mode
npm start
```

### Quick Reference Commands

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUICK REFERENCE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DOCKER COMMANDS                                                 │
│  ───────────────                                                 │
│  docker-compose up -d              Start all services           │
│  docker-compose down               Stop all services            │
│  docker-compose ps                 Check service status         │
│  docker-compose logs -f backend    View backend logs            │
│  docker-compose exec backend bash Open backend shell            │
│                                                                  │
│  BACKEND COMMANDS                                                │
│  ────────────────                                                │
│  npm install                       Install dependencies         │
│  npm run dev                       Start dev server             │
│  npm run build                     Build for production         │
│  npm start                         Start production server      │
│  npm test                          Run tests                    │
│  npx prisma generate               Generate Prisma client       │
│  npx prisma db push                Push schema to database      │
│  npx prisma db seed                Seed database                │
│                                                                  │
│  FRONTEND COMMANDS                                               │
│  ────────────────                                                │
│  npm install                       Install dependencies         │
│  npm run dev                       Start dev server             │
│  npm run build                     Build for production         │
│  npm start                         Start production server      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 15. Load Testing Guide

### Overview

Load testing verifies the platform can handle expected traffic. We use **k6** (by Grafana) for load testing.

### Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Windows
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Running Load Tests

#### Step 1: Start the Application

```bash
# With Docker
docker-compose up -d

# OR without Docker
cd backend && npm run dev &
cd frontend && npm run dev &
```

#### Step 2: Run Smoke Test (Quick Validation)

```bash
# Basic smoke test - 5 users, 30 seconds
k6 run backend/loadtests/smoke.js

# With custom parameters
k6 run --vus 10 --duration 1m backend/loadtests/smoke.js

# With custom target URL
BASE_URL=http://localhost:3000 k6 run backend/loadtests/smoke.js
```

**What it tests:**
- Health check endpoint
- Campaign listing
- Entry retrieval
- Basic response times

**Expected output:**
```
     ✓ health status is 200
     ✓ health response time < 100ms
     ✓ browse campaigns success
     ✓ check entries success

     http_req_duration..............: avg=145ms  min=12ms   med=98ms   max=890ms  p(90)=230ms  p(95)=320ms
     http_req_failed................: 0.00%  ✓ 0        ✗ 150
     http_reqs......................: 150    4.99/s
```

#### Step 3: Run Stress Test (High Load)

```bash
# Stress test - ramps up to 100 users over 15 minutes
k6 run backend/loadtests/stress.js
```

**What it tests:**
- Performance under increasing load
- System behavior at peak capacity
- Recovery after peak load

**Load stages:**
```
Stage 1: Ramp up to 20 users (1 minute)
Stage 2: Ramp up to 50 users (2 minutes)
Stage 3: Stay at 50 users (5 minutes)
Stage 4: Ramp up to 100 users (2 minutes)
Stage 5: Stay at 100 users (3 minutes)
Stage 6: Ramp down to 50 users (2 minutes)
Stage 7: Ramp down to 0 (1 minute)
```

#### Step 4: Run Draw Load Test (Critical Path)

```bash
# Draw-specific load test
k6 run backend/loadtests/draw-load.js
```

**What it tests:**
- Draw execution performance
- Concurrent draw requests
- Database performance under draw load

#### Step 5: Analyze Results

```bash
# k6 outputs JSON results
# Analyze with k6 cloud (free tier available)
k6 cloud backend/loadtests/smoke.js

# Or export to InfluxDB for Grafana visualization
INFLUXDB_URL=http://localhost:8086/k6 \
k6 run --out influxdb backend/loadtests/smoke.js
```

### Understanding k6 Output

```
┌─────────────────────────────────────────────────────────────────┐
│                    K6 METRICS EXPLAINED                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  METRIC              │ DESCRIPTION                              │
│  ────────────────────┼───────────────────────────────────────── │
│  http_reqs           │ Total number of HTTP requests           │
│  http_req_duration   │ Time taken for requests (response time) │
│  http_req_failed     │ Percentage of failed requests           │
│  http_req_blocked    │ Time spent waiting for sockets          │
│  http_req_connecting │ Time spent establishing connections     │
│  http_req_tls_handshaking │ Time spent on TLS handshake       │
│  http_req_receiving  │ Time spent receiving data               │
│  http_reqSending     │ Time spent sending data                 │
│  http_req_waiting    │ Time spent waiting for response         │
│  iterations          │ Number of script iterations             │
│  vus                 │ Number of virtual users                 │
│  vus_max             │ Maximum number of virtual users         │
│                                                                  │
│  PERCENTILES                                                     │
│  ───────────                                                     │
│  min     │ Minimum value                                        │
│  med     │ Median (50th percentile)                             │
│  avg     │ Average                                              │
│  max     │ Maximum value                                        │
│  p(90)   │ 90% of requests completed within this time          │
│  p(95)   │ 95% of requests completed within this time          │
│  p(99)   │ 99% of requests completed within this time          │
│                                                                  │
│  GOOD BENCHMARKS                                                 │
│  ───────────────                                                 │
│  http_req_duration p(95) < 500ms  → Good                       │
│  http_req_duration p(95) < 200ms  → Excellent                  │
│  http_req_failed < 1%             → Good                       │
│  http_req_failed < 0.1%           → Excellent                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Custom Load Test Script

Create your own load test:

```javascript
// backend/loadtests/custom.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,        // 20 virtual users
  duration: '5m', // Run for 5 minutes
};

export default function () {
  // Your test logic here
  const res = http.get('http://localhost:3000/api/v1/campaigns');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1); // Wait 1 second between requests
}
```

Run it:
```bash
k6 run backend/loadtests/custom.js
```

### Performance Targets

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE TARGETS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  METRIC                    │ TARGET      │ ACCEPTABLE           │
│  ──────────────────────────┼─────────────┼───────────────────── │
│  API Response Time (p95)   │ < 200ms     │ < 500ms             │
│  Entry Registration        │ < 300ms     │ < 500ms             │
│  Campaign List             │ < 150ms     │ < 300ms             │
│  Draw Execution            │ < 5 seconds │ < 10 seconds        │
│  Concurrent Users          │ 10,000+     │ 5,000+              │
│  Requests per Second       │ 1,000+      │ 500+                │
│  Error Rate                │ < 0.1%      │ < 1%                │
│  Uptime                    │ 99.9%       │ 99.5%               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 16. Troubleshooting

### Common Issues and Solutions

```
┌─────────────────────────────────────────────────────────────────┐
│                    TROUBLESHOOTING GUIDE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ISSUE: "Cannot connect to database"                            │
│  ─────────────────────────────────────                           │
│  Solution:                                                      │
│  1. Check PostgreSQL is running:                                │
│     pg_isready                                                  │
│  2. Check connection string in .env:                            │
│     DATABASE_URL="postgresql://user:pass@localhost:5432/db"    │
│  3. Create database if not exists:                              │
│     createdb luckydraw                                          │
│  4. Push schema:                                                │
│     npx prisma db push                                          │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ISSUE: "Port 3000 already in use"                              │
│  ──────────────────────────────────                              │
│  Solution:                                                      │
│  1. Find process using port:                                    │
│     lsof -i :3000                                               │
│  2. Kill the process:                                           │
│     kill -9 <PID>                                               │
│  3. Or use different port in .env:                              │
│     PORT=3001                                                   │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ISSUE: "JWT secret not defined"                                │
│  ────────────────────────────────                                │
│  Solution:                                                      │
│  1. Check .env file exists:                                     │
│     cat backend/.env                                            │
│  2. Add JWT_SECRET:                                             │
│     JWT_SECRET="your-super-secret-key"                         │
│  3. Restart server                                              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ISSUE: "Prisma client not generated"                           │
│  ────────────────────────────────────                            │
│  Solution:                                                      │
│  1. Generate client:                                            │
│     npx prisma generate                                         │
│  2. If schema changed:                                          │
│     npx prisma db push                                          │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ISSUE: "Docker containers not starting"                        │
│  ────────────────────────────────────────                        │
│  Solution:                                                      │
│  1. Check Docker is running:                                    │
│     docker ps                                                   │
│  2. Check logs:                                                 │
│     docker-compose logs                                         │
│  3. Rebuild containers:                                         │
│     docker-compose up -d --build                                │
│  4. Reset everything:                                           │
│     docker-compose down -v                                      │
│     docker-compose up -d                                        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ISSUE: "Tests failing"                                         │
│  ──────────────────────                                          │
│  Solution:                                                      │
│  1. Clear Jest cache:                                           │
│     npx jest --clearCache                                       │
│  2. Reinstall dependencies:                                     │
│     rm -rf node_modules && npm install                          │
│  3. Check for TypeScript errors:                                │
│     npx tsc --noEmit                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Health Check Endpoint

```bash
# Check if backend is healthy
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "redis": "connected"
  },
  "uptime": 3600,
  "timestamp": "2025-01-09T10:30:00Z"
}
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* npm run dev

# Or for specific module
DEBUG=express:* npm run dev
```

---

## Appendix: Complete API Reference

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/v1/auth/register | Register new user | No |
| POST | /api/v1/auth/login | Login | No |
| GET | /api/v1/auth/profile | Get profile | Yes |
| PUT | /api/v1/auth/profile | Update profile | Yes |

### Campaigns

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/v1/campaigns | List campaigns | Yes |
| GET | /api/v1/campaigns/:id | Get campaign | Yes |
| POST | /api/v1/campaigns | Create campaign | Yes (Manager) |
| PUT | /api/v1/campaigns/:id | Update campaign | Yes (Manager) |
| DELETE | /api/v1/campaigns/:id | Delete campaign | Yes (Admin) |
| POST | /api/v1/campaigns/:id/activate | Activate | Yes (Manager) |
| POST | /api/v1/campaigns/:id/pause | Pause | Yes (Manager) |
| POST | /api/v1/campaigns/:id/close | Close | Yes (Manager) |
| GET | /api/v1/campaigns/:id/stats | Get stats | Yes |

### Entries

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/v1/entries | Register entry | Yes |
| GET | /api/v1/entries | List entries | Yes (Admin) |
| GET | /api/v1/entries/customer/:id | Customer entries | Yes |
| GET | /api/v1/entries/customer/:id/summary | Summary | Yes |
| GET | /api/v1/entries/eligibility/:cid/:eid | Check eligibility | Yes |

### Draws

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /api/v1/draws/execute | Execute draw | Yes (Operator) |
| GET | /api/v1/draws | List draws | Yes |
| GET | /api/v1/draws/:id | Get draw | Yes |
| POST | /api/v1/draws/:id/witness | Add witness | Yes |
| POST | /api/v1/draws/:id/verify | Verify draw | Yes |

### Winners

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/v1/winners | List winners | Yes |
| GET | /api/v1/winners/:id | Get winner | Yes |
| PUT | /api/v1/winners/:id/status | Update status | Yes (Prize Coord) |
| POST | /api/v1/winners/:id/promote-alternate | Promote alternate | Yes |

### Admin

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /api/v1/admin/dashboard | Dashboard stats | Yes (Admin) |
| GET | /api/v1/admin/reports/campaign-performance | Report | Yes |
| GET | /api/v1/admin/reports/winner-fulfillment | Report | Yes |
| GET | /api/v1/admin/audit-logs | Audit logs | Yes (Compliance) |
| GET | /api/v1/admin/users | List users | Yes (Admin) |
| PUT | /api/v1/admin/users/:id/role | Update role | Yes (Admin) |
| PUT | /api/v1/admin/users/:id/status | Update status | Yes (Admin) |

---

**Document Version:** 1.0
**Last Updated:** 2025-01-09
**Author:** Codebuff AI Assistant

---

*This document provides complete end-to-end documentation for the Sathapana Bank Lucky Draw Platform. For questions or issues, refer to the troubleshooting section or contact the development team.*
