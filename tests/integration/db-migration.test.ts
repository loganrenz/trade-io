/**
 * Integration tests for initial database migration
 * Validates schema structure, constraints, and relationships
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Migration - Initial Schema', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.auditLog.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.order.deleteMany();
    await prisma.position.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.instrument.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('User Table', () => {
    it('should create a user with required fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          provider: 'supabase',
          providerUserId: 'supabase-123',
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.deletedAt).toBeNull();
    });

    it('should enforce unique email constraint', async () => {
      await prisma.user.create({
        data: {
          email: 'unique@example.com',
        },
      });

      await expect(
        prisma.user.create({
          data: {
            email: 'unique@example.com',
          },
        })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should enforce unique providerUserId constraint', async () => {
      await prisma.user.create({
        data: {
          email: 'user1@example.com',
          provider: 'supabase',
          providerUserId: 'unique-provider-id',
        },
      });

      await expect(
        prisma.user.create({
          data: {
            email: 'user2@example.com',
            provider: 'supabase',
            providerUserId: 'unique-provider-id',
          },
        })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should support soft delete', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'soft-delete@example.com',
        },
      });

      const deleted = await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      expect(deleted.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('Account Table', () => {
    let testUser: { id: string };

    beforeAll(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'account-owner@example.com',
        },
      });
    });

    it('should create an account with default values', async () => {
      const account = await prisma.account.create({
        data: {
          name: 'Test Account',
          ownerId: testUser.id,
        },
      });

      expect(account.id).toBeDefined();
      expect(account.name).toBe('Test Account');
      expect(account.type).toBe('INDIVIDUAL');
      expect(account.status).toBe('ACTIVE');
      expect(account.initialCash.toString()).toBe('100000');
      expect(account.ownerId).toBe(testUser.id);
      expect(account.createdAt).toBeInstanceOf(Date);
    });

    it('should cascade delete when user is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'cascade-test@example.com',
        },
      });

      const account = await prisma.account.create({
        data: {
          name: 'Cascade Test Account',
          ownerId: user.id,
        },
      });

      await prisma.user.delete({
        where: { id: user.id },
      });

      const deletedAccount = await prisma.account.findUnique({
        where: { id: account.id },
      });

      expect(deletedAccount).toBeNull();
    });
  });

  describe('Order Table', () => {
    let testAccount: { id: string };

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'order-user@example.com',
        },
      });

      testAccount = await prisma.account.create({
        data: {
          name: 'Order Test Account',
          ownerId: user.id,
        },
      });
    });

    it('should create an order with required fields', async () => {
      const order = await prisma.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          orderType: 'MARKET',
          idempotencyKey: 'test-order-1',
        },
      });

      expect(order.id).toBeDefined();
      expect(order.status).toBe('PENDING');
      expect(order.filledQuantity).toBe(0);
      expect(order.timeInForce).toBe('DAY');
      expect(order.version).toBe(1);
    });

    it('should enforce unique idempotencyKey constraint', async () => {
      await prisma.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          orderType: 'MARKET',
          idempotencyKey: 'unique-key-123',
        },
      });

      await expect(
        prisma.order.create({
          data: {
            accountId: testAccount.id,
            symbol: 'AAPL',
            side: 'BUY',
            quantity: 100,
            orderType: 'MARKET',
            idempotencyKey: 'unique-key-123',
          },
        })
      ).rejects.toThrow(/Unique constraint/);
    });

    it('should support limit orders with prices', async () => {
      const order = await prisma.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'TSLA',
          side: 'BUY',
          quantity: 50,
          orderType: 'LIMIT',
          limitPrice: 250.5,
          idempotencyKey: 'limit-order-1',
        },
      });

      expect(order.limitPrice?.toString()).toBe('250.5');
    });
  });

  describe('Position Table', () => {
    let testAccount: { id: string };

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'position-user@example.com',
        },
      });

      testAccount = await prisma.account.create({
        data: {
          name: 'Position Test Account',
          ownerId: user.id,
        },
      });
    });

    it('should create a position', async () => {
      const position = await prisma.position.create({
        data: {
          accountId: testAccount.id,
          symbol: 'MSFT',
          quantity: 100,
          averageCost: 350.75,
        },
      });

      expect(position.id).toBeDefined();
      expect(position.realizedPnL.toString()).toBe('0');
    });

    it('should enforce unique constraint on accountId + symbol', async () => {
      await prisma.position.create({
        data: {
          accountId: testAccount.id,
          symbol: 'GOOGL',
          quantity: 50,
          averageCost: 140.0,
        },
      });

      await expect(
        prisma.position.create({
          data: {
            accountId: testAccount.id,
            symbol: 'GOOGL',
            quantity: 25,
            averageCost: 145.0,
          },
        })
      ).rejects.toThrow(/Unique constraint/);
    });
  });

  describe('Ledger Entry Table', () => {
    let testAccount: { id: string };

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'ledger-user@example.com',
        },
      });

      testAccount = await prisma.account.create({
        data: {
          name: 'Ledger Test Account',
          ownerId: user.id,
        },
      });
    });

    it('should create a ledger entry', async () => {
      const entry = await prisma.ledgerEntry.create({
        data: {
          accountId: testAccount.id,
          entryType: 'DEPOSIT',
          cashAmount: 10000.0,
          balanceAfter: 110000.0,
          description: 'Initial deposit',
        },
      });

      expect(entry.id).toBeDefined();
      expect(entry.cashAmount.toString()).toBe('10000');
      expect(entry.balanceAfter.toString()).toBe('110000');
    });

    it('should support trade entries with symbol and reference', async () => {
      const order = await prisma.order.create({
        data: {
          accountId: testAccount.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          idempotencyKey: 'ledger-test-order',
        },
      });

      const entry = await prisma.ledgerEntry.create({
        data: {
          accountId: testAccount.id,
          entryType: 'TRADE',
          symbol: 'AAPL',
          quantity: 10,
          cashAmount: -1500.0,
          balanceAfter: 98500.0,
          description: 'Bought 10 shares of AAPL',
          referenceId: order.id,
        },
      });

      expect(entry.symbol).toBe('AAPL');
      expect(entry.referenceId).toBe(order.id);
    });
  });

  describe('Instrument Table', () => {
    it('should create an instrument', async () => {
      const instrument = await prisma.instrument.create({
        data: {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          type: 'STOCK',
          exchange: 'NASDAQ',
        },
      });

      expect(instrument.id).toBeDefined();
      expect(instrument.isActive).toBe(true);
      expect(instrument.isTradeable).toBe(true);
    });

    it('should enforce unique symbol constraint', async () => {
      await prisma.instrument.create({
        data: {
          symbol: 'TSLA',
          name: 'Tesla Inc.',
          exchange: 'NASDAQ',
        },
      });

      await expect(
        prisma.instrument.create({
          data: {
            symbol: 'TSLA',
            name: 'Tesla Motors',
            exchange: 'NYSE',
          },
        })
      ).rejects.toThrow(/Unique constraint/);
    });
  });

  describe('Audit Log Table', () => {
    let testUser: { id: string };

    beforeAll(async () => {
      testUser = await prisma.user.create({
        data: {
          email: 'audit-user@example.com',
        },
      });
    });

    it('should create an audit log entry', async () => {
      const log = await prisma.auditLog.create({
        data: {
          actor: testUser.id,
          action: 'USER_CREATED',
          resource: 'user',
          resourceId: testUser.id,
          metadata: {
            email: 'audit-user@example.com',
          },
          ipAddress: '127.0.0.1',
        },
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe('USER_CREATED');
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('should support nullable actor for system actions', async () => {
      const log = await prisma.auditLog.create({
        data: {
          action: 'SYSTEM_MAINTENANCE',
          resource: 'system',
        },
      });

      expect(log.actor).toBeNull();
    });

    it('should set actor to null when user is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'to-delete@example.com',
        },
      });

      const log = await prisma.auditLog.create({
        data: {
          actor: user.id,
          action: 'USER_LOGIN',
          resource: 'user',
        },
      });

      await prisma.user.delete({
        where: { id: user.id },
      });

      const updatedLog = await prisma.auditLog.findUnique({
        where: { id: log.id },
      });

      expect(updatedLog?.actor).toBeNull();
    });
  });

  describe('Execution Table', () => {
    let testOrder: { id: string; accountId: string };

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: 'execution-user@example.com',
        },
      });

      const account = await prisma.account.create({
        data: {
          name: 'Execution Test Account',
          ownerId: user.id,
        },
      });

      testOrder = await prisma.order.create({
        data: {
          accountId: account.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          orderType: 'MARKET',
          idempotencyKey: 'execution-test-order',
        },
      });
    });

    it('should create an execution', async () => {
      const execution = await prisma.execution.create({
        data: {
          orderId: testOrder.id,
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 100,
          price: 150.5,
          commission: 1.0,
        },
      });

      expect(execution.id).toBeDefined();
      expect(execution.price.toString()).toBe('150.5');
      expect(execution.commission.toString()).toBe('1');
      expect(execution.executedAt).toBeInstanceOf(Date);
    });

    it('should cascade delete when order is deleted', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'cascade-exec-user@example.com',
        },
      });

      const account = await prisma.account.create({
        data: {
          name: 'Cascade Exec Account',
          ownerId: user.id,
        },
      });

      const order = await prisma.order.create({
        data: {
          accountId: account.id,
          symbol: 'MSFT',
          side: 'SELL',
          quantity: 50,
          orderType: 'MARKET',
          idempotencyKey: 'cascade-exec-order',
        },
      });

      const execution = await prisma.execution.create({
        data: {
          orderId: order.id,
          symbol: 'MSFT',
          side: 'SELL',
          quantity: 50,
          price: 350.0,
        },
      });

      await prisma.order.delete({
        where: { id: order.id },
      });

      const deletedExecution = await prisma.execution.findUnique({
        where: { id: execution.id },
      });

      expect(deletedExecution).toBeNull();
    });
  });

  describe('Relationships', () => {
    it('should query user with accounts', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'relation-test@example.com',
          accounts: {
            create: [{ name: 'Account 1' }, { name: 'Account 2' }],
          },
        },
        include: {
          accounts: true,
        },
      });

      expect(user.accounts).toHaveLength(2);
      expect(user.accounts?.[0]?.name).toBe('Account 1');
      expect(user.accounts?.[1]?.name).toBe('Account 2');
    });

    it('should query account with orders and positions', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'complex-relation@example.com',
        },
      });

      const account = await prisma.account.create({
        data: {
          name: 'Complex Account',
          ownerId: user.id,
          orders: {
            create: {
              symbol: 'AAPL',
              side: 'BUY',
              quantity: 100,
              orderType: 'MARKET',
              idempotencyKey: 'complex-order-1',
            },
          },
          positions: {
            create: {
              symbol: 'AAPL',
              quantity: 100,
              averageCost: 150.0,
            },
          },
        },
        include: {
          orders: true,
          positions: true,
        },
      });

      expect(account.orders).toHaveLength(1);
      expect(account.positions).toHaveLength(1);
    });
  });
});
