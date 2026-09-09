import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanupDatabase() {
  // Clean in order of foreign key dependencies
  await prisma.drawWinner.deleteMany();
  await prisma.drawResult.deleteMany();
  await prisma.customerEntry.deleteMany();
  await prisma.prize.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();
}

export async function seedTestData() {
  // Create test users
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('TestPassword123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Manager',
      role: 'CAMPAIGN_MANAGER',
      isActive: true,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: 'operator@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Operator',
      role: 'OPERATOR',
      isActive: true,
    },
  });

  // Create test campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Test Campaign',
      description: 'Test campaign for integration tests',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      drawDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days
      status: 'ACTIVE',
      campaignType: 'TRANSACTION_BASED',
      minTransactionAmount: 100,
      entriesPerTransaction: 1,
      maxEntriesPerCustomer: 50,
      totalBudget: 100000,
      createdById: admin.id,
      drawSettings: {
        drawType: 'RANDOM',
        numberOfWinners: 3,
        numberOfAlternates: 5,
        allowMultipleWins: false,
        requirePresence: false,
      },
    },
  });

  // Create test prizes
  const prizes = await Promise.all([
    prisma.prize.create({
      data: {
        campaignId: campaign.id,
        rank: 1,
        name: 'Gold Necklace',
        description: '24K Gold Necklace',
        value: 5000,
        quantity: 1,
        remainingQuantity: 1,
        category: 'GOLD',
        tier: 'MAJOR',
        fulfillmentStatus: 'IN_STOCK',
      },
    }),
    prisma.prize.create({
      data: {
        campaignId: campaign.id,
        rank: 2,
        name: 'Smart Phone',
        description: 'Latest smartphone',
        value: 800,
        quantity: 5,
        remainingQuantity: 5,
        category: 'ELECTRONICS',
        tier: 'SECONDARY',
        fulfillmentStatus: 'IN_STOCK',
      },
    }),
    prisma.prize.create({
      data: {
        campaignId: campaign.id,
        rank: 3,
        name: 'Gift Card',
        description: 'Store gift card',
        value: 100,
        quantity: 20,
        remainingQuantity: 20,
        category: 'VOUCHER',
        tier: 'MINOR',
        fulfillmentStatus: 'IN_STOCK',
      },
    }),
  ]);

  return { admin, manager, operator, campaign, prizes };
}

export { prisma };
