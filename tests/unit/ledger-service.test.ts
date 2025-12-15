/**
 * Unit tests for Ledger Service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeLedgerAccounts,
  recordTransaction,
  getLedgerAccountBalance,
  getAllLedgerAccountBalances,
  getTotalAssets,
  getTotalEquity,
  verifyLedgerIntegrity,
  type LedgerTransaction,
} from '../../server/lib/ledger-service';
import { db } from '../../server/lib/db';
import Decimal from 'decimal.js';

// Mock database
vi.mock('../../server/lib/db', () => ({
  db: {
    ledgerAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Ledger Service', () => {
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174000';
  const mockLedgerAccountId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeLedgerAccounts', () => {
    it('should create standard chart of accounts with initial deposit', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue(null);

      // Mock ledgerAccount.findMany for the recordTransaction call
      const mockLedgerAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(0),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(0),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockLedgerAccounts);

      const createdAccounts: any[] = [];
      let transactionCallCount = 0;

      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        transactionCallCount++;

        // First transaction: create accounts
        if (transactionCallCount === 1) {
          const tx = {
            ledgerAccount: {
              create: vi.fn().mockImplementation((data: any) => {
                createdAccounts.push(data.data);
                return Promise.resolve(data.data);
              }),
            },
          };
          return callback(tx);
        }

        // Second transaction: initial deposit
        if (transactionCallCount === 2) {
          const tx = {
            ledgerAccount: {
              update: vi.fn().mockResolvedValue({}),
            },
            ledgerEntry: {
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return callback(tx);
        }
      });

      await initializeLedgerAccounts(mockAccountId, 100000);

      expect(db.ledgerAccount.findFirst).toHaveBeenCalledWith({
        where: { accountId: mockAccountId },
      });

      // Should create 7 standard accounts
      expect(createdAccounts).toHaveLength(7);

      // Verify account types
      const accountNames = createdAccounts.map((acc) => acc.accountName);
      expect(accountNames).toContain('Cash');
      expect(accountNames).toContain('Securities');
      expect(accountNames).toContain('Initial Capital');
      expect(accountNames).toContain('Commission');
      expect(accountNames).toContain('Fees');
    });

    it('should not reinitialize if accounts already exist', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: mockLedgerAccountId,
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(100000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await initializeLedgerAccounts(mockAccountId, 100000);

      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('should handle zero initial cash', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue(null);

      const createdAccounts: any[] = [];
      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          ledgerAccount: {
            create: vi.fn().mockImplementation((data: any) => {
              createdAccounts.push(data.data);
              return Promise.resolve(data.data);
            }),
          },
        };
        return callback(tx);
      });

      await initializeLedgerAccounts(mockAccountId, 0);

      expect(createdAccounts).toHaveLength(7);
    });
  });

  describe('recordTransaction', () => {
    it('should record a balanced transaction with debits and credits', async () => {
      const mockLedgerAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(0),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockLedgerAccounts);

      const updates: any[] = [];
      const entries: any[] = [];

      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          ledgerAccount: {
            update: vi.fn().mockImplementation((data: any) => {
              updates.push(data);
              return Promise.resolve({ ...data });
            }),
          },
          ledgerEntry: {
            create: vi.fn().mockImplementation((data: any) => {
              entries.push(data);
              return Promise.resolve({ id: 'entry-' + entries.length, ...data });
            }),
          },
        };
        return callback(tx);
      });

      const transaction: LedgerTransaction = {
        accountId: mockAccountId,
        description: 'Initial deposit',
        referenceType: 'DEPOSIT',
        entries: [
          {
            ledgerAccountSubtype: 'CASH',
            entryType: 'DEBIT',
            amount: 100000,
          },
          {
            ledgerAccountSubtype: 'INITIAL_CAPITAL',
            entryType: 'CREDIT',
            amount: 100000,
          },
        ],
      };

      const transactionId = await recordTransaction(transaction);

      expect(transactionId).toBeTruthy();
      expect(updates).toHaveLength(2);
      expect(entries).toHaveLength(2);

      // Verify cash account was debited (increased)
      expect(updates[0].data.balance).toBe(200000);

      // Verify equity account was credited (increased)
      expect(updates[1].data.balance).toBe(100000);
    });

    it('should reject unbalanced transactions', async () => {
      const transaction: LedgerTransaction = {
        accountId: mockAccountId,
        description: 'Unbalanced transaction',
        referenceType: 'ADJUSTMENT',
        entries: [
          {
            ledgerAccountSubtype: 'CASH',
            entryType: 'DEBIT',
            amount: 100,
          },
          {
            ledgerAccountSubtype: 'INITIAL_CAPITAL',
            entryType: 'CREDIT',
            amount: 50, // Not balanced!
          },
        ],
      };

      await expect(recordTransaction(transaction)).rejects.toThrow(/not balanced/);
    });

    it('should reject transactions with negative amounts', async () => {
      const transaction: LedgerTransaction = {
        accountId: mockAccountId,
        description: 'Invalid amount',
        referenceType: 'ADJUSTMENT',
        entries: [
          {
            ledgerAccountSubtype: 'CASH',
            entryType: 'DEBIT',
            amount: -100,
          },
          {
            ledgerAccountSubtype: 'INITIAL_CAPITAL',
            entryType: 'CREDIT',
            amount: -100,
          },
        ],
      };

      await expect(recordTransaction(transaction)).rejects.toThrow(/Invalid amount/);
    });

    it('should throw error if ledger account not found', async () => {
      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue([]);

      const transaction: LedgerTransaction = {
        accountId: mockAccountId,
        description: 'Missing account',
        referenceType: 'ADJUSTMENT',
        entries: [
          {
            ledgerAccountSubtype: 'NONEXISTENT',
            entryType: 'DEBIT',
            amount: 100,
          },
          {
            ledgerAccountSubtype: 'ANOTHER_NONEXISTENT',
            entryType: 'CREDIT',
            amount: 100,
          },
        ],
      };

      vi.mocked(db.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          ledgerAccount: {
            update: vi.fn(),
          },
          ledgerEntry: {
            create: vi.fn(),
          },
        };
        return callback(tx);
      });

      await expect(recordTransaction(transaction)).rejects.toThrow(/Ledger account not found/);
    });
  });

  describe('getLedgerAccountBalance', () => {
    it('should return balance for existing account', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: mockLedgerAccountId,
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(50000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const balance = await getLedgerAccountBalance(mockAccountId, 'Cash');

      expect(balance.toString()).toBe('50000');
    });

    it('should return zero for non-existent account', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue(null);

      const balance = await getLedgerAccountBalance(mockAccountId, 'Nonexistent');

      expect(balance.toString()).toBe('0');
    });
  });

  describe('getAllLedgerAccountBalances', () => {
    it('should return all accounts with balances as Decimal', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(50000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: new Decimal(30000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const accounts = await getAllLedgerAccountBalances(mockAccountId);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].balance).toBeInstanceOf(Decimal);
      expect(accounts[0].balance.toString()).toBe('50000');
      expect(accounts[1].balance.toString()).toBe('30000');
    });
  });

  describe('getTotalAssets', () => {
    it('should sum all asset account balances', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(50000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: new Decimal(30000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const total = await getTotalAssets(mockAccountId);

      expect(total.toString()).toBe('80000');
    });

    it('should return zero for account with no assets', async () => {
      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue([]);

      const total = await getTotalAssets(mockAccountId);

      expect(total.toString()).toBe('0');
    });
  });

  describe('getTotalEquity', () => {
    it('should calculate equity as assets minus liabilities', async () => {
      vi.mocked(db.ledgerAccount.findMany)
        .mockResolvedValueOnce([
          // Assets
          {
            id: '1',
            accountId: mockAccountId,
            accountType: 'ASSET',
            accountName: 'Cash',
            balance: new Decimal(80000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          // Liabilities
          {
            id: '2',
            accountId: mockAccountId,
            accountType: 'LIABILITY',
            accountName: 'Margin Debt',
            balance: new Decimal(20000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

      const equity = await getTotalEquity(mockAccountId);

      expect(equity.toString()).toBe('60000');
    });
  });

  describe('verifyLedgerIntegrity', () => {
    it('should return valid=true when accounting equation holds', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const result = await verifyLedgerIntegrity(mockAccountId);

      expect(result.valid).toBe(true);
      expect(result.assets).toBe('100000.00');
      expect(result.equity).toBe('100000.00');
      expect(result.difference).toBe('0.00');
    });

    it('should return valid=false when accounting equation does not hold', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(90000), // Imbalanced
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const result = await verifyLedgerIntegrity(mockAccountId);

      expect(result.valid).toBe(false);
      expect(result.difference).toBe('10000.00');
    });

    it('should handle revenue and expenses in accounting equation', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(105000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          accountId: mockAccountId,
          accountType: 'REVENUE',
          accountName: 'Realized Gains',
          balance: new Decimal(10000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '4',
          accountId: mockAccountId,
          accountType: 'EXPENSE',
          accountName: 'Commission',
          balance: new Decimal(5000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const result = await verifyLedgerIntegrity(mockAccountId);

      // Assets (105000) = Equity (100000) + Revenue (10000) - Expenses (5000)
      expect(result.valid).toBe(true);
      expect(result.difference).toBe('0.00');
    });
  });
});
