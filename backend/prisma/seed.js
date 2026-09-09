"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...\n');
    // ==================== USERS ====================
    const hashedPassword = await bcryptjs_1.default.hash('password123', 12);
    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@sathapana.com.kh' },
        update: {},
        create: {
            email: 'admin@sathapana.com.kh',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: client_1.UserRole.SUPER_ADMIN,
            phone: '+855 12 345 678',
        },
    });
    const campaignManager = await prisma.user.upsert({
        where: { email: 'campaign@sathapana.com.kh' },
        update: {},
        create: {
            email: 'campaign@sathapana.com.kh',
            password: hashedPassword,
            firstName: 'Campaign',
            lastName: 'Manager',
            role: client_1.UserRole.CAMPAIGN_MANAGER,
            phone: '+855 12 345 679',
        },
    });
    const marketingManager = await prisma.user.upsert({
        where: { email: 'marketing@sathapana.com.kh' },
        update: {},
        create: {
            email: 'marketing@sathapana.com.kh',
            password: hashedPassword,
            firstName: 'Marketing',
            lastName: 'Manager',
            role: client_1.UserRole.MARKETING_MANAGER,
            phone: '+855 12 345 680',
        },
    });
    const drawOperator = await prisma.user.upsert({
        where: { email: 'draw@sathapana.com.kh' },
        update: {},
        create: {
            email: 'draw@sathapana.com.kh',
            password: hashedPassword,
            firstName: 'Draw',
            lastName: 'Operator',
            role: client_1.UserRole.DRAW_OPERATOR,
            phone: '+855 12 345 681',
        },
    });
    console.log('✅ Users created');
    // ==================== CAMPAIGNS ====================
    const smartSavingsCampaign = await prisma.campaign.create({
        data: {
            name: 'Smart Savings Lucky Draw 2025',
            description: 'Open a Smart Savings Account and win a Mazda EZ-6! Every USD 150 deposited earns you 1 entry.',
            type: client_1.CampaignType.DEPOSIT_BASED,
            status: client_1.CampaignStatus.ACTIVE,
            startDate: new Date('2025-05-01'),
            endDate: new Date('2025-08-31'),
            drawDate: new Date('2025-09-15'),
            eligibilityCriteria: {
                customerTypes: ['INDIVIDUAL', 'JOINT'],
                accountTypes: ['SMART_SAVINGS'],
                minimumDeposit: 100,
                currency: 'USD',
                geographicRestriction: ['CAMBODIA'],
                ageMinimum: 18,
            },
            entryRules: [
                {
                    ruleId: 'RULE-001',
                    trigger: 'ACCOUNT_OPENED',
                    entriesPerAction: 5,
                    maxEntriesPerCustomer: 20,
                    description: '5 entries for opening a new Smart Savings Account',
                },
                {
                    ruleId: 'RULE-002',
                    trigger: 'DEPOSIT',
                    amountIncrement: 150,
                    entriesPerIncrement: 1,
                    maxEntriesPerCustomer: 50,
                    description: '1 entry for every USD 150 deposited',
                },
            ],
            drawSettings: {
                drawType: 'RANDOM',
                numberOfWinners: 1,
                numberOfAlternates: 3,
                allowMultipleWins: false,
                verificationRequired: true,
            },
            notificationSettings: {
                welcomeMessage: true,
                entryConfirmation: true,
                drawReminder: true,
                winnerAnnouncement: true,
            },
            termsAndConditions: 'Terms and conditions apply. Must be 18 years or older. Open to Cambodian residents only.',
            createdBy: superAdmin.id,
            approvedBy: marketingManager.id,
            approvedAt: new Date(),
        },
    });
    const mobileBankingCampaign = await prisma.campaign.create({
        data: {
            name: 'Mobile Banking Transaction Draw',
            description: 'Make transactions via Sathapana Mobile App and win YAMAHA PG-1 and HUAWEI WATCH GT 5 Pro!',
            type: client_1.CampaignType.TRANSACTION_BASED,
            status: client_1.CampaignStatus.ACTIVE,
            startDate: new Date('2025-08-06'),
            endDate: new Date('2025-11-30'),
            drawDate: new Date('2025-12-15'),
            eligibilityCriteria: {
                customerTypes: ['INDIVIDUAL'],
                minimumAge: 18,
            },
            entryRules: [
                {
                    ruleId: 'RULE-001',
                    trigger: 'MOBILE_TRANSACTION',
                    entriesPerAction: 1,
                    maxEntriesPerCustomer: 30,
                    description: '1 entry for every 5 mobile transactions',
                },
            ],
            drawSettings: {
                drawType: 'RANDOM',
                numberOfWinners: 2,
                numberOfAlternates: 5,
                allowMultipleWins: false,
            },
            createdBy: campaignManager.id,
        },
    });
    console.log('✅ Campaigns created');
    // ==================== PRIZES ====================
    await prisma.prize.createMany({
        data: [
            {
                campaignId: smartSavingsCampaign.id,
                rank: 1,
                name: 'Mazda EZ-6 Electric Vehicle',
                category: client_1.PrizeCategory.VEHICLE,
                description: 'Brand new Mazda EZ-6 in the color of winner\'s choice',
                quantity: 1,
                estimatedValue: 35000,
                currency: 'USD',
                vendorName: 'Mazda Cambodia',
                fulfillmentInstructions: 'Contact winner within 7 days. Vehicle handover ceremony at Sathapana HQ.',
            },
            {
                campaignId: smartSavingsCampaign.id,
                rank: 2,
                name: 'YADEA OCEAN 2025 Electric Scooter',
                category: client_1.PrizeCategory.VEHICLE,
                description: 'Brand new YADEA OCEAN 2025 electric scooter',
                quantity: 5,
                estimatedValue: 2000,
                currency: 'USD',
            },
            {
                campaignId: smartSavingsCampaign.id,
                rank: 3,
                name: 'Gold Bar 10g',
                category: client_1.PrizeCategory.GOLD,
                description: '99.99% pure gold bar',
                quantity: 20,
                estimatedValue: 800,
                currency: 'USD',
            },
            {
                campaignId: mobileBankingCampaign.id,
                rank: 1,
                name: 'YAMAHA PG-1 Motorcycle',
                category: client_1.PrizeCategory.VEHICLE,
                description: 'Brand new YAMAHA PG-1 motorcycle',
                quantity: 2,
                estimatedValue: 1500,
                currency: 'USD',
            },
            {
                campaignId: mobileBankingCampaign.id,
                rank: 2,
                name: 'HUAWEI WATCH GT 5 Pro',
                category: client_1.PrizeCategory.ELECTRONICS,
                description: 'HUAWEI WATCH GT 5 Pro smartwatch',
                quantity: 10,
                estimatedValue: 300,
                currency: 'USD',
            },
        ],
    });
    console.log('✅ Prizes created');
    // ==================== SAMPLE ENTRIES ====================
    const sampleCustomers = [
        'CUST-000001', 'CUST-000002', 'CUST-000003', 'CUST-000004', 'CUST-000005',
        'CUST-000006', 'CUST-000007', 'CUST-000008', 'CUST-000009', 'CUST-000010',
        'CUST-000011', 'CUST-000012', 'CUST-000013', 'CUST-000014', 'CUST-000015',
    ];
    const entries = [];
    for (const customerId of sampleCustomers) {
        const numEntries = Math.floor(Math.random() * 10) + 1;
        let cumulative = 0;
        for (let i = 0; i < numEntries; i++) {
            const entriesEarned = Math.floor(Math.random() * 3) + 1;
            cumulative += entriesEarned;
            entries.push({
                customerId,
                campaignId: smartSavingsCampaign.id,
                entryType: i === 0 ? client_1.EntryType.ACCOUNT_OPENED : client_1.EntryType.DEPOSIT,
                entriesEarned,
                cumulativeEntries: cumulative,
                triggerTransactionId: `TXN-${customerId}-${Date.now()}-${i}`,
                verified: true,
                verificationSource: 'SYSTEM',
            });
        }
    }
    await prisma.customerEntry.createMany({ data: entries });
    console.log('✅ Sample entries created');
    // ==================== SUMMARY ====================
    const stats = await Promise.all([
        prisma.user.count(),
        prisma.campaign.count(),
        prisma.customerEntry.count(),
        prisma.prize.count(),
    ]);
    console.log('\n📊 Database seeded successfully!');
    console.log(`   Users: ${stats[0]}`);
    console.log(`   Campaigns: ${stats[1]}`);
    console.log(`   Entries: ${stats[2]}`);
    console.log(`   Prizes: ${stats[3]}`);
    console.log('\n📧 Default login: admin@sathapana.com.kh / password123\n');
}
main()
    .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map