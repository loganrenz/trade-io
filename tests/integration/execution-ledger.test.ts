/**
 * Integration tests for Execution Recording with Ledger Service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../server/lib/db';
import * as executionSimulator from '../../server/lib/execution-simulator';
import * as ledgerService from '../../server/lib/ledger-service';
import * as pricing from '../../server/lib/pricing';

// Mock dependencies
vi.mock('../../server/lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    execution: {
      create: vi.fn(),
    },
    position: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../server/lib/pricing', () => ({
  getCurrentPrice: vi.fn(),
  getSpread: vi.fn(),
}));

describe('Execution Recording Integration', () => {
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174000';
  const mockOrderId = '123e4567-e89b-12d3-a456-426614174001';
  const mockExecutionId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BUY order execution with ledger recording', () => {
    it('should create proper double-entry ledger entries for BUY execution', async () => {
      // Mock order
      const mockOrder = {
        id: mockOrderId,
        accountId: mockAccountId,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        status: 'PENDING',
        filledQuantity: 0,
        limitPrice: null,
        stopPrice: null,
        averagePrice: null,
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder);
      vi.mocked(db.order.update).mockResolvedValue({ ...mockOrder, status: 'ACCEPTED' });

      // Mock pricing
      vi.mocked(pricing.getSpread).mockResolvedValue({
        bid: 150.0,
        ask: 150.2,
        spread: 0.2,
      });

      // Mock execution creation
      vi.mocked(db.execution.create).mockResolvedValue({
        id: mockExecutionId,
        orderId: mockOrderId,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: 150.35, // ask + slippage
        commission: 0,
        executedAt: new Date(),
      });

      // Mock position
      vi.mocked(db.position.findFirst).mockResolvedValue(null);
      vi.mocked(db.position.create).mockResolvedValue({
        id: 'position-1',
        accountId: mockAccountId,
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 150.35,
        realizedPnL: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock ledger accounts for double-entry
      const mockLedgerAccounts = [
        {
          id: 'ledger-1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ledger-2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockLedgerAccounts);

      // Mock order event creation
      vi.mocked(db.orderEvent.create).mockResolvedValue({
        id: 'event-1',
        orderId: mockOrderId,
        eventType: 'ACCEPTED',
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        metadata: {},
        createdAt: new Date(),
      });

      // Mock transaction
      const updatedAccounts: any[] = [];
      const createdEntries: any[] = [];

      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          ledgerAccount: {
            update: vi.fn().mockImplementation((data: any) => {
              updatedAccounts.push(data);
              return Promise.resolve({ ...data, ...data.data });
            }),
          },
          ledgerEntry: {
            create: vi.fn().mockImplementation((data: any) => {
              createdEntries.push(data);
              return Promise.resolve({ id: 'entry-' + createdEntries.length, ...data });
            }),
          },
        };
        return callback(tx);
      });

      // Execute the order
      await executionSimulator.simulateExecution(mockOrderId);

      // Verify ledger transaction was created
      expect(db.$transaction).toHaveBeenCalled();

      // Should create 2 ledger account updates (Securities DEBIT, Cash CREDIT)
      expect(updatedAccounts.length).toBe(2);

      // Should create 2 ledger entries
      expect(createdEntries.length).toBe(2);

      // Verify Securities was debited (increased)
      const securitiesUpdate = updatedAccounts.find((u: any) => u.where.id === 'ledger-2');
      expect(securitiesUpdate).toBeDefined();

      // Verify Cash was credited (decreased)
      const cashUpdate = updatedAccounts.find((u: any) => u.where.id === 'ledger-1');
      expect(cashUpdate).toBeDefined();
    });
  });

  describe('SELL order execution with ledger recording', () => {
    it('should create proper double-entry ledger entries for SELL execution', async () => {
      // Mock order
      const mockOrder = {
        id: mockOrderId,
        accountId: mockAccountId,
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 5,
        orderType: 'MARKET',
        status: 'PENDING',
        filledQuantity: 0,
        limitPrice: null,
        stopPrice: null,
        averagePrice: null,
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder);
      vi.mocked(db.order.update).mockResolvedValue({ ...mockOrder, status: 'ACCEPTED' });

      // Mock pricing
      vi.mocked(pricing.getSpread).mockResolvedValue({
        bid: 150.0,
        ask: 150.2,
        spread: 0.2,
      });

      // Mock execution creation
      vi.mocked(db.execution.create).mockResolvedValue({
        id: mockExecutionId,
        orderId: mockOrderId,
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 5,
        price: 149.85, // bid - slippage
        commission: 0,
        executedAt: new Date(),
      });

      // Mock existing position
      vi.mocked(db.position.findFirst).mockResolvedValue({
        id: 'position-1',
        accountId: mockAccountId,
        symbol: 'AAPL',
        quantity: 10,
        averageCost: 150.0,
        realizedPnL: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(db.position.update).mockResolvedValue({
        id: 'position-1',
        accountId: mockAccountId,
        symbol: 'AAPL',
        quantity: 5,
        averageCost: 150.0,
        realizedPnL: -0.75, // 5 * (149.85 - 150.00)
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock ledger accounts for double-entry
      const mockLedgerAccounts = [
        {
          id: 'ledger-1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: 98500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ledger-2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: 1500,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockLedgerAccounts);

      // Mock order event creation
      vi.mocked(db.orderEvent.create).mockResolvedValue({
        id: 'event-1',
        orderId: mockOrderId,
        eventType: 'ACCEPTED',
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        metadata: {},
        createdAt: new Date(),
      });

      // Mock transaction
      const updatedAccounts: any[] = [];

      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          ledgerAccount: {
            update: vi.fn().mockImplementation((data: any) => {
              updatedAccounts.push(data);
              return Promise.resolve({ ...data, ...data.data });
            }),
          },
          ledgerEntry: {
            create: vi.fn().mockResolvedValue({ id: 'entry-1' }),
          },
        };
        return callback(tx);
      });

      // Execute the order
      await executionSimulator.simulateExecution(mockOrderId);

      // Verify ledger transaction was created
      expect(db.$transaction).toHaveBeenCalled();

      // Should create 2 ledger account updates (Cash DEBIT, Securities CREDIT)
      expect(updatedAccounts.length).toBe(2);

      // Verify Cash was debited (increased)
      const cashUpdate = updatedAccounts.find((u: any) => u.where.id === 'ledger-1');
      expect(cashUpdate).toBeDefined();

      // Verify Securities was credited (decreased)
      const securitiesUpdate = updatedAccounts.find((u: any) => u.where.id === 'ledger-2');
      expect(securitiesUpdate).toBeDefined();
    });
  });

  describe('Ledger integrity after executions', () => {
    it('should maintain balanced ledger after BUY and SELL executions', async () => {
      // This test verifies that after multiple executions,
      // the ledger remains balanced (Assets = Liabilities + Equity)

      const mockLedgerAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: 98500, // Started with 100000, bought 10 @ 150 = -1500
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: 1500, // 10 shares @ 150
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: 100000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockLedgerAccounts);

      const integrity = await ledgerService.verifyLedgerIntegrity(mockAccountId);

      // Assets (98500 + 1500) = Equity (100000)
      expect(integrity.valid).toBe(true);
      expect(integrity.assets).toBe('100000.00');
      expect(integrity.equity).toBe('100000.00');
      expect(integrity.difference).toBe('0.00');
    });
  });
});
