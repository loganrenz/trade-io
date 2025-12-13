/**
 * Integration tests for Authorization Middleware
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '~/server/lib/db';
import {
  router,
  publicProcedure,
  protectedProcedure,
  accountProtectedProcedure,
  orderProtectedProcedure,
  positionProtectedProcedure,
} from '~/server/trpc/trpc';
import { z } from 'zod';
import type { Context } from '~/server/trpc/context';
import { createCallerFactory } from '@trpc/server';

// Test router
const testRouter = router({
  // Public endpoint (no auth)
  public: publicProcedure.query(() => {
    return { message: 'public' };
  }),

  // Protected endpoint (auth only)
  protected: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.userId };
  }),

  // Account-protected endpoint
  getAccount: accountProtectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ input }) => {
      const account = await db.account.findUnique({
        where: { id: input.accountId },
      });
      return account;
    }),

  // Order-protected endpoint
  getOrder: orderProtectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      const order = await db.order.findUnique({
        where: { id: input.orderId },
      });
      return order;
    }),

  // Position-protected endpoint
  getPosition: positionProtectedProcedure
    .input(z.object({ positionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const position = await db.position.findUnique({
        where: { id: input.positionId },
      });
      return position;
    }),
});

type TestRouter = typeof testRouter;

describe('Authorization Middleware Integration', () => {
  let testUser1Id: string;
  let testUser2Id: string;
  let testAccountId: string;
  let testOrderId: string;
  let testPositionId: string;

  beforeEach(async () => {
    // Create test users
    const user1 = await db.user.create({
      data: {
        email: `test1-${Date.now()}@example.com`,
        emailVerified: true,
        provider: 'test',
        providerUserId: `test-${Date.now()}-1`,
      },
    });
    testUser1Id = user1.id;

    const user2 = await db.user.create({
      data: {
        email: `test2-${Date.now()}@example.com`,
        emailVerified: true,
        provider: 'test',
        providerUserId: `test-${Date.now()}-2`,
      },
    });
    testUser2Id = user2.id;

    // Create test account owned by user1
    const account = await db.account.create({
      data: {
        name: 'Test Account',
        type: 'INDIVIDUAL',
        ownerId: testUser1Id,
      },
    });
    testAccountId = account.id;

    // Create test instrument
    await db.instrument.create({
      data: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        type: 'STOCK',
        exchange: 'NASDAQ',
        isTradeable: true,
      },
    });

    // Create test order for the account
    const order = await db.order.create({
      data: {
        accountId: testAccountId,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        timeInForce: 'DAY',
        status: 'PENDING',
        idempotencyKey: `test-order-${Date.now()}`,
      },
    });
    testOrderId = order.id;

    // Create test position for the account
    const position = await db.position.create({
      data: {
        accountId: testAccountId,
        symbol: 'AAPL',
        quantity: 100,
        averageCost: 150.0,
      },
    });
    testPositionId = position.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.position.deleteMany();
    await db.order.deleteMany();
    await db.instrument.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
  });

  function createCaller(userId: string | null) {
    const mockContext: Context = {
      userId,
      requestId: 'test-request-id',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      logger: {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        child: () => ({}) as any,
      } as any,
    };

    const createCaller = createCallerFactory<TestRouter>();
    return createCaller(testRouter)(mockContext);
  }

  describe('publicProcedure', () => {
    it('should allow unauthenticated access', async () => {
      const caller = createCaller(null);
      const result = await caller.public();
      expect(result).toEqual({ message: 'public' });
    });
  });

  describe('protectedProcedure', () => {
    it('should allow authenticated access', async () => {
      const caller = createCaller(testUser1Id);
      const result = await caller.protected();
      expect(result).toEqual({ userId: testUser1Id });
    });

    it('should deny unauthenticated access', async () => {
      const caller = createCaller(null);
      await expect(caller.protected()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('accountProtectedProcedure', () => {
    it('should allow access when user owns the account', async () => {
      const caller = createCaller(testUser1Id);
      const result = await caller.getAccount({ accountId: testAccountId });
      expect(result).toBeDefined();
      expect(result?.id).toBe(testAccountId);
    });

    it('should deny access when user does not own the account', async () => {
      const caller = createCaller(testUser2Id);
      await expect(caller.getAccount({ accountId: testAccountId })).rejects.toThrow('FORBIDDEN');
    });

    it('should deny access when user is not authenticated', async () => {
      const caller = createCaller(null);
      await expect(caller.getAccount({ accountId: testAccountId })).rejects.toThrow('UNAUTHORIZED');
    });

    it('should throw NOT_FOUND when account does not exist', async () => {
      const caller = createCaller(testUser1Id);
      const fakeAccountId = '00000000-0000-0000-0000-000000000000';
      await expect(caller.getAccount({ accountId: fakeAccountId })).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('orderProtectedProcedure', () => {
    it('should allow access when user owns the order account', async () => {
      const caller = createCaller(testUser1Id);
      const result = await caller.getOrder({ orderId: testOrderId });
      expect(result).toBeDefined();
      expect(result?.id).toBe(testOrderId);
    });

    it('should deny access when user does not own the order account', async () => {
      const caller = createCaller(testUser2Id);
      await expect(caller.getOrder({ orderId: testOrderId })).rejects.toThrow('FORBIDDEN');
    });

    it('should deny access when user is not authenticated', async () => {
      const caller = createCaller(null);
      await expect(caller.getOrder({ orderId: testOrderId })).rejects.toThrow('UNAUTHORIZED');
    });

    it('should throw NOT_FOUND when order does not exist', async () => {
      const caller = createCaller(testUser1Id);
      const fakeOrderId = '00000000-0000-0000-0000-000000000000';
      await expect(caller.getOrder({ orderId: fakeOrderId })).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('positionProtectedProcedure', () => {
    it('should allow access when user owns the position account', async () => {
      const caller = createCaller(testUser1Id);
      const result = await caller.getPosition({ positionId: testPositionId });
      expect(result).toBeDefined();
      expect(result?.id).toBe(testPositionId);
    });

    it('should deny access when user does not own the position account', async () => {
      const caller = createCaller(testUser2Id);
      await expect(caller.getPosition({ positionId: testPositionId })).rejects.toThrow('FORBIDDEN');
    });

    it('should deny access when user is not authenticated', async () => {
      const caller = createCaller(null);
      await expect(caller.getPosition({ positionId: testPositionId })).rejects.toThrow(
        'UNAUTHORIZED'
      );
    });

    it('should throw NOT_FOUND when position does not exist', async () => {
      const caller = createCaller(testUser1Id);
      const fakePositionId = '00000000-0000-0000-0000-000000000000';
      await expect(caller.getPosition({ positionId: fakePositionId })).rejects.toThrow('NOT_FOUND');
    });
  });
});
