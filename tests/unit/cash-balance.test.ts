/**
 * Unit tests for Cash Balance Service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCashBalance,
  getSecuritiesValue,
  getBuyingPower,
  hasSufficientBuyingPower,
  getAvailableCash,
  getAccountBalanceSummary,
  getLedgerAccountBreakdown,
} from '../../server/lib/cash-balance';
import { db } from '../../server/lib/db';
import * as ledgerService from '../../server/lib/ledger-service';
import Decimal from 'decimal.js';

// Mock database
vi.mock('../../server/lib/db', () => ({
  db: {
    account: {
      findUnique: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    ledgerAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
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

describe('Cash Balance Service', () => {
  const mockAccountId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCashBalance', () => {
    it('should return cash balance from ledger', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: '1',
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(50000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const balance = await getCashBalance(mockAccountId);

      expect(balance.toString()).toBe('50000');
      expect(db.ledgerAccount.findFirst).toHaveBeenCalledWith({
        where: {
          accountId: mockAccountId,
          accountName: {
            equals: 'Cash',
            mode: 'insensitive',
          },
        },
      });
    });

    it('should return zero if no cash account exists', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue(null);

      const balance = await getCashBalance(mockAccountId);

      expect(balance.toString()).toBe('0');
    });
  });

  describe('getSecuritiesValue', () => {
    it('should return securities value from ledger', async () => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: '2',
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Securities',
        balance: new Decimal(30000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const value = await getSecuritiesValue(mockAccountId);

      expect(value.toString()).toBe('30000');
    });
  });

  describe('getBuyingPower', () => {
    it('should return cash balance for INDIVIDUAL accounts', async () => {
      vi.mocked(db.account.findUnique).mockResolvedValue({
        id: mockAccountId,
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: new Decimal(100000),
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: '1',
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(50000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const buyingPower = await getBuyingPower(mockAccountId);

      expect(buyingPower.toString()).toBe('50000');
    });

    it('should throw error if account not found', async () => {
      vi.mocked(db.account.findUnique).mockResolvedValue(null);

      await expect(getBuyingPower(mockAccountId)).rejects.toThrow('Account not found');
    });
  });

  describe('hasSufficientBuyingPower', () => {
    beforeEach(() => {
      vi.mocked(db.account.findUnique).mockResolvedValue({
        id: mockAccountId,
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: new Decimal(100000),
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: '1',
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(50000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return true if buying power is sufficient', async () => {
      const result = await hasSufficientBuyingPower(mockAccountId, 30000);

      expect(result).toBe(true);
    });

    it('should return false if buying power is insufficient', async () => {
      const result = await hasSufficientBuyingPower(mockAccountId, 60000);

      expect(result).toBe(false);
    });

    it('should handle exact match', async () => {
      const result = await hasSufficientBuyingPower(mockAccountId, 50000);

      expect(result).toBe(true);
    });

    it('should work with Decimal input', async () => {
      const result = await hasSufficientBuyingPower(mockAccountId, new Decimal(40000));

      expect(result).toBe(true);
    });
  });

  describe('getAvailableCash', () => {
    beforeEach(() => {
      vi.mocked(db.ledgerAccount.findFirst).mockResolvedValue({
        id: '1',
        accountId: mockAccountId,
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: new Decimal(50000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should return full cash balance when no pending orders', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([]);

      const available = await getAvailableCash(mockAccountId);

      expect(available.toString()).toBe('50000');
    });

    it('should subtract pending LIMIT BUY orders from cash balance', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([
        {
          id: 'order-1',
          accountId: mockAccountId,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          filledQuantity: 0,
          orderType: 'LIMIT',
          limitPrice: new Decimal(150),
          stopPrice: null,
          status: 'PENDING',
          averagePrice: null,
          timeInForce: 'DAY',
          idempotencyKey: 'key-1',
          rejectionReason: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
        },
      ]);

      const available = await getAvailableCash(mockAccountId);

      // 50000 - (100 * 150) = 35000
      expect(available.toString()).toBe('35000');
    });

    it('should handle partially filled orders', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([
        {
          id: 'order-1',
          accountId: mockAccountId,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          filledQuantity: 30,
          orderType: 'LIMIT',
          limitPrice: new Decimal(150),
          stopPrice: null,
          status: 'PARTIAL',
          averagePrice: new Decimal(150),
          timeInForce: 'DAY',
          idempotencyKey: 'key-1',
          rejectionReason: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
        },
      ]);

      const available = await getAvailableCash(mockAccountId);

      // 50000 - ((100 - 30) * 150) = 50000 - 10500 = 39500
      expect(available.toString()).toBe('39500');
    });

    it('should handle multiple pending orders', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([
        {
          id: 'order-1',
          accountId: mockAccountId,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 50,
          filledQuantity: 0,
          orderType: 'LIMIT',
          limitPrice: new Decimal(150),
          stopPrice: null,
          status: 'PENDING',
          averagePrice: null,
          timeInForce: 'DAY',
          idempotencyKey: 'key-1',
          rejectionReason: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
        },
        {
          id: 'order-2',
          accountId: mockAccountId,
          symbol: 'GOOGL',
          side: 'BUY',
          quantity: 20,
          filledQuantity: 0,
          orderType: 'LIMIT',
          limitPrice: new Decimal(1000),
          stopPrice: null,
          status: 'ACCEPTED',
          averagePrice: null,
          timeInForce: 'GTC',
          idempotencyKey: 'key-2',
          rejectionReason: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt: null,
        },
      ]);

      const available = await getAvailableCash(mockAccountId);

      // 50000 - (50 * 150 + 20 * 1000) = 50000 - 27500 = 22500
      expect(available.toString()).toBe('22500');
    });
  });

  describe('getAccountBalanceSummary', () => {
    beforeEach(() => {
      // Mock cash balance
      vi.mocked(db.ledgerAccount.findFirst)
        .mockResolvedValueOnce({
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(60000),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: '2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: new Decimal(40000),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(60000),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(60000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      // Mock account
      vi.mocked(db.account.findUnique).mockResolvedValue({
        id: mockAccountId,
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: new Decimal(100000),
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      // Mock no pending orders
      vi.mocked(db.order.findMany).mockResolvedValue([]);
    });

    it('should return complete balance summary', async () => {
      const summary = await getAccountBalanceSummary(mockAccountId);

      expect(summary.cashBalance).toBe('60000.00');
      expect(summary.securitiesValue).toBe('40000.00');
      expect(summary.totalAssets).toBe('100000.00');
      expect(summary.buyingPower).toBe('60000.00');
      expect(summary.availableCash).toBe('60000.00');
      expect(summary.reservedCash).toBe('0.00');
    });
  });

  describe('getLedgerAccountBreakdown', () => {
    it('should return all ledger accounts with balances', async () => {
      const mockAccounts = [
        {
          id: '1',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Cash',
          balance: new Decimal(60000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          accountId: mockAccountId,
          accountType: 'ASSET',
          accountName: 'Securities',
          balance: new Decimal(40000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '3',
          accountId: mockAccountId,
          accountType: 'EQUITY',
          accountName: 'Initial Capital',
          balance: new Decimal(100000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.ledgerAccount.findMany).mockResolvedValue(mockAccounts);

      const breakdown = await getLedgerAccountBreakdown(mockAccountId);

      expect(breakdown).toHaveLength(3);
      expect(breakdown[0]).toEqual({
        accountType: 'ASSET',
        accountName: 'Cash',
        balance: '60000.00',
      });
      expect(breakdown[1]).toEqual({
        accountType: 'ASSET',
        accountName: 'Securities',
        balance: '40000.00',
      });
      expect(breakdown[2]).toEqual({
        accountType: 'EQUITY',
        accountName: 'Initial Capital',
        balance: '100000.00',
      });
    });
  });
});
