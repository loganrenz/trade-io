/**
 * Order API Integration Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/lib/db';
import { appRouter } from '../../server/trpc/routers/_app';
import type { Context } from '../../server/trpc/context';

describe('Order API', () => {
  let testUser: any;
  let testAccount: any;
  let testInstrument: any;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(async () => {
    // Create test user
    testUser = await db.user.create({
      data: {
        email: 'order-test@example.com',
        emailVerified: true,
      },
    });

    // Create test account
    testAccount = await db.account.create({
      data: {
        name: 'Order Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: 100000,
        ownerId: testUser.id,
      },
    });

    // Create test instrument
    testInstrument = await db.instrument.create({
      data: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'STOCK',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      },
    });

    // Create quote data
    await db.quote.create({
      data: {
        instrumentId: testInstrument.id,
        symbol: 'AAPL',
        timestamp: new Date(),
        bid: 150.25,
        ask: 150.5,
        last: 150.35,
        volume: BigInt(10000000),
      },
    });

    // Create trading session
    await db.tradingSession.create({
      data: {
        instrumentId: testInstrument.id,
        exchange: 'NASDAQ',
        sessionType: 'REGULAR',
        openTime: new Date('2024-01-01T09:30:00'),
        closeTime: new Date('2024-01-01T16:00:00'),
      },
    });

    // Create tRPC caller with test context
    const ctx: Context = {
      userId: testUser.id,
      user: testUser,
      requestId: 'test-request-id',
    };
    caller = appRouter.createCaller(ctx);
  });

  afterEach(async () => {
    await db.orderEvent.deleteMany();
    await db.execution.deleteMany();
    await db.order.deleteMany();
    await db.quote.deleteMany();
    await db.tradingSession.deleteMany();
    await db.position.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    await db.instrument.deleteMany();
    await db.auditLog.deleteMany();
  });

  describe('place', () => {
    it('should place a market buy order', async () => {
      const order = await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(order).toBeDefined();
      expect(order.accountId).toBe(testAccount.id);
      expect(order.symbol).toBe('AAPL');
      expect(order.side).toBe('BUY');
      expect(order.quantity).toBe(10);
      expect(order.orderType).toBe('MARKET');
      expect(order.status).toBe('PENDING');
    });

    it('should place a limit sell order', async () => {
      const order = await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 5,
        orderType: 'LIMIT',
        limitPrice: 155.0,
        timeInForce: 'GTC',
      });

      expect(order).toBeDefined();
      expect(order.orderType).toBe('LIMIT');
      expect(order.limitPrice).toBeDefined();
      expect(Number(order.limitPrice)).toBe(155.0);
    });

    it('should support idempotency - return same order for duplicate request', async () => {
      const idempotencyKey = 'test-idempotency-key-1';

      const order1 = await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
        idempotencyKey,
      });

      const order2 = await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
        idempotencyKey,
      });

      expect(order1.id).toBe(order2.id);
    });

    it('should reject order with insufficient buying power', async () => {
      await expect(
        caller.order.place({
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10000, // Very large quantity
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow(/Insufficient buying power/);
    });

    it('should reject order for invalid symbol', async () => {
      await expect(
        caller.order.place({
          accountId: testAccount.id,
          symbol: 'INVALID',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        })
      ).rejects.toThrow();
    });

    it('should reject limit order without limit price', async () => {
      await expect(
        caller.order.place({
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'LIMIT',
          timeInForce: 'DAY',
        } as any)
      ).rejects.toThrow();
    });

    it('should create audit log entry for order placement', async () => {
      await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      const auditLogs = await db.auditLog.findMany({
        where: {
          action: 'ORDER_PLACED',
          actor: testUser.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    it('should create order event on order creation', async () => {
      const order = await caller.order.place({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      const events = await db.orderEvent.findMany({
        where: { orderId: order.id },
      });

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].eventType).toBe('CREATED');
      expect(events[0].newStatus).toBe('PENDING');
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create some test orders
      await db.order.createMany({
        data: [
          {
            accountId: testAccount.id,
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            status: 'PENDING',
            timeInForce: 'DAY',
            idempotencyKey: 'test-1',
          },
          {
            accountId: testAccount.id,
            symbol: 'AAPL',
            side: 'SELL',
            quantity: 5,
            orderType: 'LIMIT',
            limitPrice: 155,
            status: 'FILLED',
            timeInForce: 'GTC',
            idempotencyKey: 'test-2',
          },
          {
            accountId: testAccount.id,
            symbol: 'GOOGL',
            side: 'BUY',
            quantity: 3,
            orderType: 'MARKET',
            status: 'CANCELLED',
            timeInForce: 'DAY',
            idempotencyKey: 'test-3',
          },
        ],
      });
    });

    it('should list all orders for an account', async () => {
      const result = await caller.order.list({
        accountId: testAccount.id,
        limit: 10,
        offset: 0,
      });

      expect(result.orders).toBeDefined();
      expect(result.orders.length).toBe(3);
      expect(result.pagination.total).toBe(3);
    });

    it('should filter orders by status', async () => {
      const result = await caller.order.list({
        accountId: testAccount.id,
        status: 'PENDING',
        limit: 10,
        offset: 0,
      });

      expect(result.orders.length).toBe(1);
      expect(result.orders[0].status).toBe('PENDING');
    });

    it('should filter orders by symbol', async () => {
      const result = await caller.order.list({
        accountId: testAccount.id,
        symbol: 'AAPL',
        limit: 10,
        offset: 0,
      });

      expect(result.orders.length).toBe(2);
      expect(result.orders.every((o) => o.symbol === 'AAPL')).toBe(true);
    });

    it('should support pagination', async () => {
      const result = await caller.order.list({
        accountId: testAccount.id,
        limit: 2,
        offset: 0,
      });

      expect(result.orders.length).toBe(2);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('get', () => {
    it('should get order by ID', async () => {
      const createdOrder = await db.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          status: 'PENDING',
          timeInForce: 'DAY',
          idempotencyKey: 'test-get-1',
        },
      });

      const order = await caller.order.get({
        orderId: createdOrder.id,
      });

      expect(order).toBeDefined();
      expect(order?.id).toBe(createdOrder.id);
      expect(order?.account).toBeDefined();
      expect(order?.executions).toBeDefined();
      expect(order?.events).toBeDefined();
    });

    it('should reject getting order from different user', async () => {
      // Create another user and account
      const otherUser = await db.user.create({
        data: {
          email: 'other@example.com',
          emailVerified: true,
        },
      });

      const otherAccount = await db.account.create({
        data: {
          name: 'Other Account',
          type: 'INDIVIDUAL',
          ownerId: otherUser.id,
        },
      });

      const otherOrder = await db.order.create({
        data: {
          accountId: otherAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          status: 'PENDING',
          timeInForce: 'DAY',
          idempotencyKey: 'test-other-1',
        },
      });

      await expect(
        caller.order.get({
          orderId: otherOrder.id,
        })
      ).rejects.toThrow(/Access denied/);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending order', async () => {
      const createdOrder = await db.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          status: 'PENDING',
          timeInForce: 'DAY',
          idempotencyKey: 'test-cancel-1',
        },
      });

      const cancelledOrder = await caller.order.cancel({
        orderId: createdOrder.id,
        reason: 'User requested',
      });

      expect(cancelledOrder.status).toBe('CANCELLED');

      // Check for cancellation event
      const events = await db.orderEvent.findMany({
        where: {
          orderId: createdOrder.id,
          eventType: 'CANCELLED',
        },
      });

      expect(events.length).toBe(1);
    });

    it('should reject cancelling a filled order', async () => {
      const filledOrder = await db.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          status: 'FILLED',
          timeInForce: 'DAY',
          idempotencyKey: 'test-cancel-filled',
        },
      });

      await expect(
        caller.order.cancel({
          orderId: filledOrder.id,
        })
      ).rejects.toThrow(/Cannot cancel order/);
    });

    it('should create audit log for order cancellation', async () => {
      const createdOrder = await db.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          status: 'PENDING',
          timeInForce: 'DAY',
          idempotencyKey: 'test-cancel-audit',
        },
      });

      await caller.order.cancel({
        orderId: createdOrder.id,
      });

      const auditLogs = await db.auditLog.findMany({
        where: {
          action: 'ORDER_CANCELLED',
          resourceId: createdOrder.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('history', () => {
    beforeEach(async () => {
      // Create order history
      await db.order.createMany({
        data: [
          {
            accountId: testAccount.id,
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 10,
            orderType: 'MARKET',
            status: 'FILLED',
            timeInForce: 'DAY',
            idempotencyKey: 'history-1',
          },
          {
            accountId: testAccount.id,
            symbol: 'AAPL',
            side: 'SELL',
            quantity: 5,
            orderType: 'LIMIT',
            limitPrice: 155,
            status: 'CANCELLED',
            timeInForce: 'GTC',
            idempotencyKey: 'history-2',
          },
          {
            accountId: testAccount.id,
            symbol: 'GOOGL',
            side: 'BUY',
            quantity: 3,
            orderType: 'MARKET',
            status: 'PENDING', // Should not appear in history
            timeInForce: 'DAY',
            idempotencyKey: 'history-3',
          },
        ],
      });
    });

    it('should return completed orders', async () => {
      const result = await caller.order.history({
        accountId: testAccount.id,
        limit: 10,
        offset: 0,
      });

      expect(result.orders.length).toBe(2);
      expect(
        result.orders.every((o) =>
          ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(o.status)
        )
      ).toBe(true);
    });

    it('should include executions in history', async () => {
      const result = await caller.order.history({
        accountId: testAccount.id,
        limit: 10,
        offset: 0,
      });

      expect(result.orders[0].executions).toBeDefined();
    });
  });
});
