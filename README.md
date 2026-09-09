# Sathapana Bank Lucky Draw Platform

A full-stack web application for managing lucky draw campaigns for Sathapana Bank (Cambodia) Plc.

## 🎯 Features

### Customer Features
- **Browse Campaigns** - View all active lucky draw campaigns
- **Earn Entries** - Get entries through qualifying transactions and deposits
- **Track Progress** - See your entry history and campaign participation
- **View Winners** - Check announced winners and results

### Admin Features
- **Campaign Management** - Create, edit, activate, and close campaigns
- **Draw Execution** - Run cryptographically secure random draws
- **Winner Management** - Track and manage prize fulfillment
- **Analytics Dashboard** - View statistics and reports
- **User Management** - Manage admin users and roles
- **Audit Logs** - Complete audit trail for compliance

## 🏗️ Architecture

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
│                     API Gateway (Express.js)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Campaign    │  │  Entry/Ticket    │  │  Draw Engine     │
│  Service     │  │  Service         │  │  (CSPRNG)        │
└──────┬───────┘  └────────┬─────────┘  └────────┬─────────┘
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                        │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **Auth:** JWT (JSON Web Tokens)

### Frontend
- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Icons:** React Icons

### Infrastructure
- **Containerization:** Docker & Docker Compose
- **CI/CD:** GitHub Actions (recommended)

## 📦 Project Structure

```
sathapana-luckydraw/
├── backend/                    # Express.js API
│   ├── prisma/                 # Database schema & migrations
│   │   ├── schema.prisma       # Database models
│   │   └── seed.ts             # Seed data
│   ├── src/
│   │   ├── config/             # Configuration
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Utility functions
│   └── Dockerfile
├── frontend/                   # Next.js app
│   ├── app/                    # Pages (App Router)
│   ├── lib/                    # Utilities & API client
│   └── Dockerfile
├── docker-compose.yml          # Full stack setup
└── SPEC.md                     # Project specification
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd sathapana-luckydraw

# Start all services
docker-compose up -d

# Run database migrations and seed
docker-compose exec backend npx prisma db push
docker-compose exec backend npx prisma db seed

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000/api/v1
```

### Manual Setup

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma db push

# Seed database
npx prisma db seed

# Start development server
npm run dev
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔐 Authentication

### Default Admin Credentials
- **Email:** admin@sathapana.com.kh
- **Password:** password123

### User Roles
| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | Full access to all features |
| CAMPAIGN_MANAGER | Create, edit, activate campaigns |
| MARKETING_MANAGER | Approve campaigns, view reports |
| DRAW_OPERATOR | Execute draws, view results |
| PRIZE_COORDINATOR | Manage prizes, track fulfillment |
| COMPLIANCE_OFFICER | View audit logs, generate reports |
| READ_ONLY | View dashboards and reports |

## 📡 API Endpoints

### Authentication
```
POST   /api/v1/auth/register     # Register new user
POST   /api/v1/auth/login        # Login
GET    /api/v1/auth/profile      # Get current user profile
PUT    /api/v1/auth/profile      # Update profile
```

### Campaigns
```
GET    /api/v1/campaigns              # List campaigns
GET    /api/v1/campaigns/:id          # Get campaign details
POST   /api/v1/campaigns              # Create campaign
PUT    /api/v1/campaigns/:id          # Update campaign
DELETE /api/v1/campaigns/:id          # Delete campaign (draft only)
POST   /api/v1/campaigns/:id/activate # Activate campaign
POST   /api/v1/campaigns/:id/pause    # Pause campaign
POST   /api/v1/campaigns/:id/close    # Close campaign
GET    /api/v1/campaigns/:id/stats    # Get campaign statistics
```

### Entries
```
POST   /api/v1/entries                      # Register entry
GET    /api/v1/entries                      # List entries
GET    /api/v1/entries/customer/:id         # Get customer entries
GET    /api/v1/entries/customer/:id/summary # Get customer summary
GET    /api/v1/entries/eligibility/:custId/:campId # Check eligibility
```

### Draws
```
POST   /api/v1/draws                # Execute draw
GET    /api/v1/draws                # List draws
GET    /api/v1/draws/:id            # Get draw details
POST   /api/v1/draws/:id/witness    # Add witness
POST   /api/v1/draws/:id/verify     # Verify draw results
```

### Prizes
```
GET    /api/v1/prizes               # List prizes
GET    /api/v1/prizes/:id           # Get prize details
POST   /api/v1/prizes               # Create prize
PUT    /api/v1/prizes/:id           # Update prize
DELETE /api/v1/prizes/:id           # Delete prize
```

### Winners
```
GET    /api/v1/winners              # List winners
GET    /api/v1/winners/:id          # Get winner details
PUT    /api/v1/winners/:id/status   # Update winner status
POST   /api/v1/winners/:id/promote-alternate # Promote alternate
```

### Admin
```
GET    /api/v1/admin/dashboard              # Dashboard statistics
GET    /api/v1/admin/reports/campaign-performance
GET    /api/v1/admin/reports/winner-fulfillment
GET    /api/v1/admin/audit-logs             # View audit logs
GET    /api/v1/admin/users                  # List users
PUT    /api/v1/admin/users/:id/role         # Update user role
PUT    /api/v1/admin/users/:id/status       # Activate/deactivate user
```

## 🎰 Draw Engine

The draw engine uses cryptographically secure random number generation (CSPRNG) for fair winner selection:

1. **Weighted Selection** - Customers with more entries have proportionally higher chances
2. **Deterministic Replay** - Same seed produces same results for audit verification
3. **Audit Trail** - Complete record of draw execution with hash verification
4. **Witness Requirement** - Multiple authorized personnel must witness the draw

## 📊 Database Schema

Key entities:
- **User** - Admin users with roles
- **Campaign** - Lucky draw campaigns with rules
- **CustomerEntry** - Customer entries earned
- **Prize** - Available prizes
- **DrawResult** - Draw execution results
- **DrawWinner** - Selected winners
- **Notification** - Customer notifications
- **AuditLog** - System audit trail

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend build check
cd frontend
npm run build
```

## 📝 Environment Variables

### Backend (.env)
```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/luckydraw"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:3001"
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## 🚢 Deployment

### Production Deployment

1. **Build Docker images:**
   ```bash
   docker-compose -f docker-compose.yml build
   ```

2. **Set production environment variables**

3. **Run with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

4. **Run migrations:**
   ```bash
   docker-compose exec backend npx prisma migrate deploy
   ```

### Recommended Production Setup
- Use a managed PostgreSQL (AWS RDS, Google Cloud SQL)
- Use a managed Redis (AWS ElastiCache, Redis Cloud)
- Deploy behind a load balancer
- Enable SSL/TLS
- Set up monitoring (Prometheus + Grafana)

## 📄 License

This project is proprietary software for Sathapana Bank (Cambodia) Plc.

---

**Built with ❤️ for Sathapana Bank**
