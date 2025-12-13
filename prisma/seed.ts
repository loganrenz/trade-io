/**
 * Database Seed Script
 * Populates development database with test data
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.warn('🌱 Seeding database...');

  // Clean existing data (in reverse dependency order)
  console.warn('  Cleaning existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.execution.deleteMany();
  await prisma.order.deleteMany();
  await prisma.position.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerAccount.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.bar.deleteMany();
  await prisma.tradingSession.deleteMany();
  await prisma.riskLimit.deleteMany();
  await prisma.symbolRestriction.deleteMany();
  await prisma.instrument.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  console.warn('  Creating users...');
  const user1 = await prisma.user.create({
    data: {
      email: 'test@trade.io',
      emailVerified: true,
      provider: 'supabase',
      providerUserId: 'test-user-1',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'demo@trade.io',
      emailVerified: true,
      provider: 'supabase',
      providerUserId: 'demo-user-1',
    },
  });

  // Create test accounts
  console.warn('  Creating accounts...');
  const account1 = await prisma.account.create({
    data: {
      name: 'Test Trading Account',
      type: 'INDIVIDUAL',
      status: 'ACTIVE',
      initialCash: 100000,
      ownerId: user1.id,
    },
  });

  const account2 = await prisma.account.create({
    data: {
      name: 'Demo Account',
      type: 'INDIVIDUAL',
      status: 'ACTIVE',
      initialCash: 50000,
      ownerId: user2.id,
    },
  });

  // Create instruments (popular stocks)
  console.warn('  Creating instruments...');
  const instruments = [
    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
    { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
    { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  ];

  const createdInstruments = [];
  for (const inst of instruments) {
    const instrument = await prisma.instrument.create({
      data: {
        symbol: inst.symbol,
        name: inst.name,
        type: 'STOCK',
        exchange: inst.exchange,
        isActive: true,
        isTradeable: true,
      },
    });
    createdInstruments.push(instrument);
  }

  // Create trading sessions
  console.warn('  Creating trading sessions...');
  await prisma.tradingSession.create({
    data: {
      exchange: 'NASDAQ',
      sessionType: 'REGULAR',
      openTime: new Date('1970-01-01T09:30:00Z'),
      closeTime: new Date('1970-01-01T16:00:00Z'),
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      timezone: 'America/New_York',
    },
  });

  await prisma.tradingSession.create({
    data: {
      exchange: 'NYSE',
      sessionType: 'REGULAR',
      openTime: new Date('1970-01-01T09:30:00Z'),
      closeTime: new Date('1970-01-01T16:00:00Z'),
      daysOfWeek: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
    },
  });

  // Create sample quotes for first few instruments
  console.warn('  Creating sample quotes...');
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const instrument = createdInstruments[i];
    const basePrice = 150 + i * 50;

    await prisma.quote.create({
      data: {
        instrumentId: instrument.id,
        timestamp: now,
        bid: basePrice - 0.05,
        ask: basePrice + 0.05,
        last: basePrice,
        volume: 1000000 + i * 500000,
      },
    });
  }

  // Create sample bars (1-day historical data)
  console.warn('  Creating sample bars...');
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  for (let i = 0; i < 3; i++) {
    const instrument = createdInstruments[i];
    const basePrice = 150 + i * 50;

    await prisma.bar.create({
      data: {
        instrumentId: instrument.id,
        timeframe: '1d',
        timestamp: yesterday,
        open: basePrice - 2,
        high: basePrice + 3,
        low: basePrice - 5,
        close: basePrice,
        volume: 5000000 + i * 1000000,
      },
    });
  }

  // Create ledger entries (initial deposit)
  console.warn('  Creating ledger entries...');
  await prisma.ledgerEntry.create({
    data: {
      accountId: account1.id,
      entryType: 'DEPOSIT',
      cashAmount: 100000,
      balanceAfter: 100000,
      description: 'Initial deposit',
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      accountId: account2.id,
      entryType: 'DEPOSIT',
      cashAmount: 50000,
      balanceAfter: 50000,
      description: 'Initial deposit',
    },
  });

  // Create risk limits
  console.warn('  Creating risk limits...');
  await prisma.riskLimit.create({
    data: {
      accountId: account1.id,
      limitType: 'MAX_ORDER_VALUE',
      limitValue: 10000,
      currentValue: 0,
      isActive: true,
    },
  });

  await prisma.riskLimit.create({
    data: {
      accountId: account1.id,
      limitType: 'MAX_DAILY_LOSS',
      limitValue: 5000,
      currentValue: 0,
      isActive: true,
    },
  });

  console.warn('✅ Seed completed successfully!');
  console.warn('\n📊 Created:');
  console.warn(`   - ${2} users`);
  console.warn(`   - ${2} accounts`);
  console.warn(`   - ${instruments.length} instruments`);
  console.warn(`   - ${2} trading sessions`);
  console.warn(`   - ${3} quotes`);
  console.warn(`   - ${3} bars`);
  console.warn(`   - ${2} ledger entries`);
  console.warn(`   - ${2} risk limits`);
  console.warn('\n🔑 Test Credentials:');
  console.warn('   Email: test@trade.io');
  console.warn('   Email: demo@trade.io');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
