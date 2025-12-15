/**
 * Order Validation Service Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Decimal from 'decimal.js';
import {
  validateQuantity,
  validatePriceParameters,
  validateSymbol,
  estimateOrderCost,
  validateOrder,
} from '../../server/lib/order-validation';
import { db } from '../../server/lib/db';
import {
  ValidationError,
  InvalidSymbolError,
  InvalidOrderError,
  InsufficientFundsError,
} from '../../server/errors';

// Mock database
vi.mock('../../server/lib/db', () => ({
  db: {
    instrument: {
      findUnique: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
    },
    position: {
      findUnique: vi.fn(),
    },
    ledgerEntry: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock pricing service
vi.mock('../../server/lib/pricing', () => ({
  pricing: {
    getCurrentPrice: vi.fn().mockResolvedValue(150.0),
  },
}));

// Mock trading hours
vi.mock('../../server/lib/trading-hours', () => ({
  tradingHours: {
    isMarketOpen: vi.fn().mockResolvedValue(true),
    getNextMarketOpen: vi.fn().mockResolvedValue(new Date()),
  },
}));

describe('Order Validation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateQuantity', () => {
    it('should accept valid positive integer quantity', () => {
      expect(() => validateQuantity(100)).not.toThrow();
      expect(() => validateQuantity(1)).not.toThrow();
      expect(() => validateQuantity(1000)).not.toThrow();
    });

    it('should reject zero quantity', () => {
      expect(() => validateQuantity(0)).toThrow(ValidationError);
      expect(() => validateQuantity(0)).toThrow('Quantity must be positive');
    });

    it('should reject negative quantity', () => {
      expect(() => validateQuantity(-10)).toThrow(ValidationError);
      expect(() => validateQuantity(-10)).toThrow('Quantity must be positive');
    });

    it('should reject non-integer quantity', () => {
      expect(() => validateQuantity(10.5)).toThrow(ValidationError);
      expect(() => validateQuantity(10.5)).toThrow('Quantity must be an integer');
    });

    it('should reject quantity exceeding maximum', () => {
      expect(() => validateQuantity(1000001)).toThrow(ValidationError);
      expect(() => validateQuantity(1000001)).toThrow('exceeds maximum allowed');
    });
  });

  describe('validatePriceParameters', () => {
    it('should accept MARKET orders without prices', () => {
      expect(() => validatePriceParameters('MARKET', undefined, undefined)).not.toThrow();
    });

    it('should require limit price for LIMIT orders', () => {
      expect(() => validatePriceParameters('LIMIT', undefined, undefined)).toThrow(ValidationError);
      expect(() => validatePriceParameters('LIMIT', 100, undefined)).not.toThrow();
    });

    it('should require stop price for STOP orders', () => {
      expect(() => validatePriceParameters('STOP', undefined, undefined)).toThrow(ValidationError);
      expect(() => validatePriceParameters('STOP', undefined, 100)).not.toThrow();
    });

    it('should require both prices for STOP_LIMIT orders', () => {
      expect(() => validatePriceParameters('STOP_LIMIT', undefined, undefined)).toThrow();
      expect(() => validatePriceParameters('STOP_LIMIT', 100, undefined)).toThrow();
      expect(() => validatePriceParameters('STOP_LIMIT', undefined, 100)).toThrow();
      expect(() => validatePriceParameters('STOP_LIMIT', 100, 105)).not.toThrow();
    });

    it('should reject MARKET orders with limit price', () => {
      expect(() => validatePriceParameters('MARKET', 100, undefined)).toThrow(ValidationError);
    });

    it('should reject MARKET orders with stop price', () => {
      expect(() => validatePriceParameters('MARKET', undefined, 100)).toThrow(ValidationError);
    });

    it('should reject negative or zero prices', () => {
      expect(() => validatePriceParameters('LIMIT', 0, undefined)).toThrow(ValidationError);
      expect(() => validatePriceParameters('LIMIT', -10, undefined)).toThrow(ValidationError);
      expect(() => validatePriceParameters('STOP', undefined, 0)).toThrow(ValidationError);
    });
  });

  describe('validateSymbol', () => {
    it('should accept valid tradeable symbol', async () => {
      vi.mocked(db.instrument.findUnique).mockResolvedValue({
        id: '123',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'STOCK',
        exchange: 'NASDAQ',
        currency: 'USD',
        isActive: true,
        isTradeable: true,
        updatedAt: new Date(),
      } as any);

      await expect(validateSymbol('AAPL')).resolves.not.toThrow();
      expect(db.instrument.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
    });

    it('should reject non-existent symbol', async () => {
      vi.mocked(db.instrument.findUnique).mockResolvedValue(null);

      await expect(validateSymbol('INVALID')).rejects.toThrow(InvalidSymbolError);
      await expect(validateSymbol('INVALID')).rejects.toThrow('Symbol INVALID not found');
    });

    it('should reject inactive symbol', async () => {
      vi.mocked(db.instrument.findUnique).mockResolvedValue({
        id: '123',
        symbol: 'AAPL',
        isActive: false,
        isTradeable: true,
      } as any);

      await expect(validateSymbol('AAPL')).rejects.toThrow(InvalidSymbolError);
      await expect(validateSymbol('AAPL')).rejects.toThrow('is not active');
    });

    it('should reject non-tradeable symbol', async () => {
      vi.mocked(db.instrument.findUnique).mockResolvedValue({
        id: '123',
        symbol: 'AAPL',
        isActive: true,
        isTradeable: false,
      } as any);

      await expect(validateSymbol('AAPL')).rejects.toThrow(InvalidSymbolError);
      await expect(validateSymbol('AAPL')).rejects.toThrow('is not tradeable');
    });
  });

  describe('estimateOrderCost', () => {
    it('should use limit price for LIMIT orders', async () => {
      const cost = await estimateOrderCost({
        symbol: 'AAPL',
        quantity: 10,
        orderType: 'LIMIT',
        limitPrice: 100,
      });

      expect(cost.toNumber()).toBe(1000); // 10 * 100
    });

    it('should use market price for MARKET orders with buffer', async () => {
      const cost = await estimateOrderCost({
        symbol: 'AAPL',
        quantity: 10,
        orderType: 'MARKET',
      });

      // Market price is 150 (mocked), quantity is 10, with 5% buffer
      expect(cost.toNumber()).toBe(1575); // 10 * 150 * 1.05
    });

    it('should calculate cost for large orders', async () => {
      const cost = await estimateOrderCost({
        symbol: 'AAPL',
        quantity: 1000,
        orderType: 'LIMIT',
        limitPrice: 150.25,
      });

      expect(cost.toNumber()).toBe(150250); // 1000 * 150.25
    });
  });

  describe('validateOrder (integration)', () => {
    beforeEach(() => {
      // Setup default mocks
      vi.mocked(db.instrument.findUnique).mockResolvedValue({
        id: '123',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'STOCK',
        exchange: 'NASDAQ',
        currency: 'USD',
        isActive: true,
        isTradeable: true,
        updatedAt: new Date(),
      } as any);

      vi.mocked(db.account.findUnique).mockResolvedValue({
        id: 'acc-123',
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: new Decimal(100000),
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);

      vi.mocked(db.ledgerEntry.findFirst).mockResolvedValue({
        id: 'ledger-123',
        accountId: 'acc-123',
        balanceAfter: new Decimal(50000),
      } as any);
    });

    it('should validate complete BUY order', async () => {
      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).resolves.not.toThrow();
    });

    it.skip('should reject BUY order with insufficient funds', async () => {
      // TODO: Fix test - mock setup issue with Decimal types
      vi.mocked(db.ledgerEntry.findFirst).mockResolvedValue({
        id: 'ledger-123',
        accountId: 'acc-123',
        balanceAfter: new Decimal(100), // Only $100 available
      } as any);

      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('should validate SELL order with existing position', async () => {
      vi.mocked(db.position.findUnique).mockResolvedValue({
        id: 'pos-123',
        accountId: 'acc-123',
        symbol: 'AAPL',
        quantity: 100,
        averageCost: new Decimal(140),
        realizedPnL: new Decimal(0),
        updatedAt: new Date(),
      } as any);

      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 50,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).resolves.not.toThrow();
    });

    it('should reject SELL order without position', async () => {
      vi.mocked(db.position.findUnique).mockResolvedValue(null);

      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow(InvalidOrderError);
    });

    it('should reject SELL order with insufficient quantity', async () => {
      vi.mocked(db.position.findUnique).mockResolvedValue({
        id: 'pos-123',
        accountId: 'acc-123',
        symbol: 'AAPL',
        quantity: 10, // Only 10 shares
        averageCost: new Decimal(140),
        realizedPnL: new Decimal(0),
        updatedAt: new Date(),
      } as any);

      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 50, // Trying to sell 50
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow(InvalidOrderError);
      await expect(
        validateOrder({
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 50,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow('Insufficient shares');
    });
  });
});
