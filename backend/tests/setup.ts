import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/luckydraw_test',
    },
  },
});

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  console.log('Connected to test database');
});

afterAll(async () => {
  // Clean up and disconnect
  await prisma.$disconnect();
  console.log('Disconnected from test database');
});

export { prisma };
