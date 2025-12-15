/**
 * Order Service Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { placeOrder } from '../../server/lib/order-service';
import {
  ValidationError,
  InsufficientFundsError,
  InvalidOrderError,
  MarketClosedError,
  InvalidSymbolError,
} from '../../server/errors';

// Create mock functions
const mockOrderFindUnique = vi.fn();
const mockOrderCreate = vi.fn();
const mockOrderUpdate = vi.fn();
const mockOrderFindMany = vi.fn();
const mockAccountFindUnique = vi.fn();
const mockInstrumentFindUnique = vi.fn();
const mockPositionFindUnique = vi.fn();
const mockPositionCreate = vi.fn();
const mockPositionUpdate = vi.fn();
const mockPositionDelete = vi.fn();
const mockExecutionCreate = vi.fn();
const mockExecutionFindMany = vi.fn();
const mockOrderEventCreate = vi.fn();
const mockTransaction = vi.fn();

const mockGetCurrentPrice = vi.fn();
const mockIsExchangeOpen = vi.fn();
const mockGetTradingHours = vi.fn();
const mockAudit = vi.fn();

// Mock dependencies
vi.mock('../../server/lib/db', () => ({
  db: {
    order: {
      findUnique: (...args: any[]) => mockOrderFindUnique(...args),
      create: (...args: any[]) => mockOrderCreate(...args),
      update: (...args: any[]) => mockOrderUpdate(...args),
      findMany: (...args: any[]) => mockOrderFindMany(...args),
    },
    account: {
      findUnique: (...args: any[]) => mockAccountFindUnique(...args),
    },
    instrument: {
      findUnique: (...args: any[]) => mockInstrumentFindUnique(...args),
    },
    position: {
      findUnique: (...args: any[]) => mockPositionFindUnique(...args),
      create: (...args: any[]) => mockPositionCreate(...args),
      update: (...args: any[]) => mockPositionUpdate(...args),
      delete: (...args: any[]) => mockPositionDelete(...args),
    },
    execution: {
      create: (...args: any[]) => mockExecutionCreate(...args),
      findMany: (...args: any[]) => mockExecutionFindMany(...args),
    },
    orderEvent: {
      create: (...args: any[]) => mockOrderEventCreate(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

vi.mock('../../server/lib/pricing', () => ({
  getCurrentPrice: (...args: any[]) => mockGetCurrentPrice(...args),
}));

vi.mock('../../server/lib/trading-hours', () => ({
  isExchangeOpen: (...args: any[]) => mockIsExchangeOpen(...args),
  getTradingHours: (...args: any[]) => mockGetTradingHours(...args),
}));

vi.mock('../../server/lib/audit', () => ({
  audit: (...args: any[]) => mockAudit(...args),
}));

vi.mock('../../server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe('Order Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('placeOrder - Market Order', () => {
    it('should place a market BUY order and execute immediately', async () => {
      const mockAccount = {
        id: 'account-123',
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: 100000,
        ownerId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const mockInstrument = {
        id: 'instrument-123',
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'STOCK',
        exchange: 'NASDAQ',
        currency: 'USD',
        sector: 'Technology',
        industry: null,
        marketCap: null,
        isActive: true,
        isTradeable: true,
        updatedAt: new Date(),
      };

      const mockOrder = {
        id: 'order-123',
        accountId: 'account-123',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        limitPrice: null,
        stopPrice: null,
        status: 'FILLED',
        filledQuantity: 10,
        averagePrice: 150.50,
        timeInForce: 'DAY',
        idempotencyKey: 'idempotency-123',
        rejectionReason: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      const mockExecution = {
        id: 'execution-123',
        orderId: 'order-123',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        price: 150.50,
        commission: 0,
        executedAt: new Date(),
      };

      // Setup mocks
      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument);
      mockIsExchangeOpen.mockResolvedValue(true);
      mockGetCurrentPrice.mockResolvedValue(150.50);
      mockPositionFindUnique.mockResolvedValue(null);
      mockOrderFindMany.mockResolvedValue([]); // Mock for calculateBuyingPower
      mockExecutionFindMany.mockResolvedValue([]);

      // Mock transaction
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          order: {
            create: vi.fn().mockResolvedValue(mockOrder),
            update: vi.fn().mockResolvedValue({...mockOrder, status: 'FILLED', filledQuantity: 10, averagePrice: 150.50}),
          },
          orderEvent: {
            create: vi.fn().mockResolvedValue({}),
          },
          execution: {
            create: vi.fn().mockResolvedValue(mockExecution),
          },
          position: {
            create: vi.fn().mockResolvedValue({}),
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return await callback(txMock);
      });

      const result = await placeOrder(
        {
          accountId: 'account-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          userId: 'user-123',
        },
        'idempotency-123'
      );

      expect(result.order).toBeDefined();
      expect(result.order.symbol).toBe('AAPL');
      expect(result.order.status).toBe('FILLED');
      expect(result.execution).toBeDefined();
      expect(result.execution?.quantity).toBe(10);
      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORDER_PLACED',
          resource: 'order',
          actor: 'user-123',
        })
      );
    });

    it('should reject market order when market is closed', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);
      mockIsExchangeOpen.mockResolvedValue(false);
      mockGetTradingHours.mockResolvedValue({
        isOpen: false,
        exchange: 'NASDAQ',
        nextOpen: new Date('2024-01-02T09:30:00Z'),
      });

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(MarketClosedError);
    });

    it('should reject order when insufficient buying power', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);
      mockIsExchangeOpen.mockResolvedValue(true);
      mockGetCurrentPrice.mockResolvedValue(150.50);
      mockOrderFindMany.mockResolvedValue([]);
      mockExecutionFindMany.mockResolvedValue([]);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(InsufficientFundsError);
    });
  });

  describe('placeOrder - Limit Order', () => {
    it('should place a limit BUY order without immediate execution', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      const mockOrder = {
        id: 'order-123',
        accountId: 'account-123',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'LIMIT',
        limitPrice: 145.00,
        stopPrice: null,
        status: 'PENDING',
        filledQuantity: 0,
        averagePrice: null,
        timeInForce: 'DAY',
        idempotencyKey: 'idempotency-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);
      mockOrderFindMany.mockResolvedValue([]);
      mockExecutionFindMany.mockResolvedValue([]);

      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          order: {
            create: vi.fn().mockResolvedValue(mockOrder),
          },
          orderEvent: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(txMock);
      });

      const result = await placeOrder(
        {
          accountId: 'account-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'LIMIT',
          limitPrice: 145.00,
          userId: 'user-123',
        },
        'idempotency-123'
      );

      expect(result.order.status).toBe('PENDING');
      expect(result.order.limitPrice).toBe(145.00);
      expect(result.execution).toBeUndefined();
    });

    it('should validate limit price is required for LIMIT orders', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);
      mockOrderFindMany.mockResolvedValue([]);
      mockExecutionFindMany.mockResolvedValue([]);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'LIMIT',
            // limitPrice is missing!
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('placeOrder - SELL Order', () => {
    it('should reject SELL order when position is insufficient', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      const mockPosition = {
        accountId: 'account-123',
        symbol: 'AAPL',
        quantity: 5, // Only 5 shares available
        averageCost: 140.00,
        realizedPnL: 0,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);
      mockPositionFindUnique.mockResolvedValue(mockPosition as any);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'SELL',
            quantity: 10, // Trying to sell 10 shares but only have 5
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(InvalidOrderError);
    });
  });

  describe('placeOrder - Validation', () => {
    it('should reject order for non-existent account', async () => {
      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(null);

      await expect(
        placeOrder(
          {
            accountId: 'nonexistent',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject order for suspended account', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'SUSPENDED',
        initialCash: 100000,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should reject order for non-existent symbol', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(null);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'INVALID',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(InvalidSymbolError);
    });

    it('should reject order for non-tradeable symbol', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: false,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(InvalidSymbolError);
    });

    it('should validate quantity is positive', async () => {
      const mockAccount = {
        id: 'account-123',
        status: 'ACTIVE',
        initialCash: 100000,
      };

      const mockInstrument = {
        symbol: 'AAPL',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      };

      mockOrderFindUnique.mockResolvedValue(null);
      mockAccountFindUnique.mockResolvedValue(mockAccount as any);
      mockInstrumentFindUnique.mockResolvedValue(mockInstrument as any);

      await expect(
        placeOrder(
          {
            accountId: 'account-123',
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 0, // Invalid
            orderType: 'MARKET',
            userId: 'user-123',
          },
          'idempotency-123'
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('placeOrder - Idempotency', () => {
    it('should return existing order for duplicate idempotency key', async () => {
      const existingOrder = {
        id: 'order-123',
        accountId: 'account-123',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        limitPrice: null,
        stopPrice: null,
        status: 'FILLED',
        filledQuantity: 10,
        averagePrice: 150.50,
        timeInForce: 'DAY',
        idempotencyKey: 'idempotency-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
        executions: [],
      };

      mockOrderFindUnique.mockResolvedValue(existingOrder as any);

      const result = await placeOrder(
        {
          accountId: 'account-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          userId: 'user-123',
        },
        'idempotency-123'
      );

      expect(result.order.id).toBe('order-123');
      expect(result.order.status).toBe('FILLED');
      // Should not create new order
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });
});
