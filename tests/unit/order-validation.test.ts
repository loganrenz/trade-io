/**
 * Order Validation Service Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/lib/db';
import {
  validateOrder,
  calculateOrderValue,
  checkBuyingPower,
  checkPositionLimits,
} from '../../server/lib/order-validation';

describe('Order Validation Service', () => {
  let testInstrument: any;
  let testAccount: any;

  beforeEach(async () => {
    // Create test instrument
    testInstrument = await db.instrument.create({
      data: {
        symbol: 'TEST',
        name: 'Test Stock',
        type: 'STOCK',
        exchange: 'NASDAQ',
        isActive: true,
        isTradeable: true,
      },
    });

    // Create test account
    const testUser = await db.user.create({
      data: {
        email: 'test-order@example.com',
        emailVerified: true,
      },
    });

    testAccount = await db.account.create({
      data: {
        name: 'Test Account',
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        initialCash: 100000,
        ownerId: testUser.id,
      },
    });

    // Create test quote
    await db.quote.create({
      data: {
        instrumentId: testInstrument.id,
        symbol: 'TEST',
        timestamp: new Date(),
        bid: 100.5,
        ask: 100.75,
        last: 100.6,
        volume: BigInt(1000000),
      },
    });
  });

  afterEach(async () => {
    await db.quote.deleteMany();
    await db.order.deleteMany();
    await db.position.deleteMany();
    await db.ledgerEntry.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    await db.instrument.deleteMany();
    await db.symbolRestriction.deleteMany();
    await db.riskLimit.deleteMany();
  });

  describe('validateOrder', () => {
    it('should validate a valid market order', async () => {
      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should validate a valid limit order', async () => {
      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'LIMIT',
        limitPrice: 100,
        timeInForce: 'GTC',
      });

      expect(result.valid).toBe(true);
    });

    it('should reject order with zero quantity', async () => {
      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 0,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Quantity must be positive');
    });

    it('should reject limit order without limit price', async () => {
      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'LIMIT',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Limit price required for LIMIT orders');
    });

    it('should reject order for non-existent symbol', async () => {
      const result = await validateOrder({
        symbol: 'INVALID',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should reject order for non-tradeable symbol', async () => {
      await db.instrument.update({
        where: { id: testInstrument.id },
        data: { isTradeable: false },
      });

      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not tradeable');
    });

    it('should reject market order with GTC time in force', async () => {
      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
        timeInForce: 'GTC',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('MARKET orders cannot be GTC');
    });

    it('should reject order for restricted symbol', async () => {
      await db.symbolRestriction.create({
        data: {
          symbol: 'TEST',
          isActive: true,
          reason: 'Test restriction',
        },
      });

      const result = await validateOrder({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
        timeInForce: 'DAY',
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('restricted');
    });
  });

  describe('calculateOrderValue', () => {
    it('should calculate value for limit order', async () => {
      const result = await calculateOrderValue({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'LIMIT',
        limitPrice: 100,
      });

      expect(result).toBeDefined();
      expect(result?.estimatedPrice).toBe(100);
      expect(result?.estimatedCost).toBe(10000);
      expect(result?.commission).toBe(0);
    });

    it('should calculate value for market order using current price', async () => {
      const result = await calculateOrderValue({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      });

      expect(result).toBeDefined();
      expect(result?.estimatedPrice).toBeGreaterThan(0);
      expect(result?.estimatedCost).toBeGreaterThan(0);
    });

    it('should return null for symbol without pricing', async () => {
      await db.quote.deleteMany({ where: { symbol: 'TEST' } });

      const result = await calculateOrderValue({
        symbol: 'TEST',
        side: 'BUY',
        quantity: 100,
        orderType: 'MARKET',
      });

      expect(result).toBeNull();
    });
  });

  describe('checkBuyingPower', () => {
    it('should pass for account with sufficient cash', async () => {
      const result = await checkBuyingPower(testAccount.id, 50000);

      expect(result.sufficient).toBe(true);
      expect(result.available).toBeGreaterThanOrEqual(50000);
    });

    it('should fail for account with insufficient cash', async () => {
      const result = await checkBuyingPower(testAccount.id, 150000);

      expect(result.sufficient).toBe(false);
      expect(result.required).toBe(150000);
    });

    it('should account for pending orders', async () => {
      // Create a pending order
      await db.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'TEST',
          side: 'BUY',
          quantity: 100,
          orderType: 'LIMIT',
          limitPrice: 100,
          status: 'PENDING',
          timeInForce: 'DAY',
          idempotencyKey: 'test-key-1',
        },
      });

      const result = await checkBuyingPower(testAccount.id, 50000);

      // Should have less buying power due to pending order
      expect(result.available).toBeLessThan(100000);
    });
  });

  describe('checkPositionLimits', () => {
    it('should allow position within limits', async () => {
      await db.riskLimit.create({
        data: {
          accountId: testAccount.id,
          maxPositionSize: 1000,
        },
      });

      const result = await checkPositionLimits(testAccount.id, 'TEST', 100, 'BUY');

      expect(result.allowed).toBe(true);
    });

    it('should reject position exceeding limits', async () => {
      await db.riskLimit.create({
        data: {
          accountId: testAccount.id,
          maxPositionSize: 50,
        },
      });

      const result = await checkPositionLimits(testAccount.id, 'TEST', 100, 'BUY');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('exceed maximum position size');
    });

    it('should allow position when no limits are set', async () => {
      const result = await checkPositionLimits(testAccount.id, 'TEST', 1000000, 'BUY');

      expect(result.allowed).toBe(true);
    });
  });
});
