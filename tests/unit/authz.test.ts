/**
 * Unit tests for Authorization Service
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '~/server/lib/db';
import {
  checkAccountAccess,
  isAccountOwner,
  getUserAccountIds,
  checkOrderAccess,
  checkPositionAccess,
  accountOwnerFilter,
  userAccountsFilter,
} from '~/server/lib/authz';
import { ForbiddenError, NotFoundError } from '~/server/errors';

describe('Authorization Service', () => {
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

  describe('checkAccountAccess', () => {
    it('should allow access when user owns the account', async () => {
      await expect(checkAccountAccess(testUser1Id, testAccountId)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when user does not own the account', async () => {
      await expect(checkAccountAccess(testUser2Id, testAccountId)).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when account does not exist', async () => {
      const fakeAccountId = '00000000-0000-0000-0000-000000000000';
      await expect(checkAccountAccess(testUser1Id, fakeAccountId)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when account is soft-deleted', async () => {
      // Soft delete the account
      await db.account.update({
        where: { id: testAccountId },
        data: { deletedAt: new Date() },
      });

      await expect(checkAccountAccess(testUser1Id, testAccountId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('isAccountOwner', () => {
    it('should return true when user owns the account', async () => {
      const result = await isAccountOwner(testUser1Id, testAccountId);
      expect(result).toBe(true);
    });

    it('should return false when user does not own the account', async () => {
      const result = await isAccountOwner(testUser2Id, testAccountId);
      expect(result).toBe(false);
    });

    it('should return false when account does not exist', async () => {
      const fakeAccountId = '00000000-0000-0000-0000-000000000000';
      const result = await isAccountOwner(testUser1Id, fakeAccountId);
      expect(result).toBe(false);
    });

    it('should return false when account is soft-deleted', async () => {
      await db.account.update({
        where: { id: testAccountId },
        data: { deletedAt: new Date() },
      });

      const result = await isAccountOwner(testUser1Id, testAccountId);
      expect(result).toBe(false);
    });
  });

  describe('getUserAccountIds', () => {
    it('should return array of account IDs for user', async () => {
      const accountIds = await getUserAccountIds(testUser1Id);
      expect(accountIds).toEqual([testAccountId]);
    });

    it('should return empty array when user has no accounts', async () => {
      const accountIds = await getUserAccountIds(testUser2Id);
      expect(accountIds).toEqual([]);
    });

    it('should not include soft-deleted accounts', async () => {
      await db.account.update({
        where: { id: testAccountId },
        data: { deletedAt: new Date() },
      });

      const accountIds = await getUserAccountIds(testUser1Id);
      expect(accountIds).toEqual([]);
    });

    it('should return multiple account IDs when user has multiple accounts', async () => {
      const account2 = await db.account.create({
        data: {
          name: 'Test Account 2',
          type: 'MARGIN',
          ownerId: testUser1Id,
        },
      });

      const accountIds = await getUserAccountIds(testUser1Id);
      expect(accountIds).toHaveLength(2);
      expect(accountIds).toContain(testAccountId);
      expect(accountIds).toContain(account2.id);
    });
  });

  describe('checkOrderAccess', () => {
    it('should allow access when user owns the order account', async () => {
      await expect(checkOrderAccess(testUser1Id, testOrderId)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when user does not own the order account', async () => {
      await expect(checkOrderAccess(testUser2Id, testOrderId)).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when order does not exist', async () => {
      const fakeOrderId = '00000000-0000-0000-0000-000000000000';
      await expect(checkOrderAccess(testUser1Id, fakeOrderId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkPositionAccess', () => {
    it('should allow access when user owns the position account', async () => {
      await expect(checkPositionAccess(testUser1Id, testPositionId)).resolves.toBeUndefined();
    });

    it('should throw ForbiddenError when user does not own the position account', async () => {
      await expect(checkPositionAccess(testUser2Id, testPositionId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw NotFoundError when position does not exist', async () => {
      const fakePositionId = '00000000-0000-0000-0000-000000000000';
      await expect(checkPositionAccess(testUser1Id, fakePositionId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('accountOwnerFilter', () => {
    it('should return correct filter for account owner', () => {
      const filter = accountOwnerFilter(testUser1Id);
      expect(filter).toEqual({
        account: {
          ownerId: testUser1Id,
          deletedAt: null,
        },
      });
    });

    it('should filter orders correctly', async () => {
      // Create another user and account
      const user3 = await db.user.create({
        data: {
          email: `test3-${Date.now()}@example.com`,
          emailVerified: true,
          provider: 'test',
          providerUserId: `test-${Date.now()}-3`,
        },
      });

      const account3 = await db.account.create({
        data: {
          name: 'User 3 Account',
          type: 'INDIVIDUAL',
          ownerId: user3.id,
        },
      });

      await db.order.create({
        data: {
          accountId: account3.id,
          symbol: 'AAPL',
          side: 'SELL',
          quantity: 5,
          orderType: 'MARKET',
          timeInForce: 'DAY',
          status: 'PENDING',
          idempotencyKey: `test-order-${Date.now()}-2`,
        },
      });

      // Query orders with filter
      const user1Orders = await db.order.findMany({
        where: accountOwnerFilter(testUser1Id),
      });

      expect(user1Orders).toHaveLength(1);
      expect(user1Orders[0].id).toBe(testOrderId);
    });
  });

  describe('userAccountsFilter', () => {
    it('should return correct filter for user accounts', () => {
      const filter = userAccountsFilter(testUser1Id);
      expect(filter).toEqual({
        ownerId: testUser1Id,
        deletedAt: null,
      });
    });

    it('should filter accounts correctly', async () => {
      // Create another account for user1
      const account2 = await db.account.create({
        data: {
          name: 'User 1 Second Account',
          type: 'MARGIN',
          ownerId: testUser1Id,
        },
      });

      // Create account for user2
      await db.account.create({
        data: {
          name: 'User 2 Account',
          type: 'INDIVIDUAL',
          ownerId: testUser2Id,
        },
      });

      // Query accounts with filter
      const user1Accounts = await db.account.findMany({
        where: userAccountsFilter(testUser1Id),
      });

      expect(user1Accounts).toHaveLength(2);
      const accountIds = user1Accounts.map((a: { id: string }) => a.id);
      expect(accountIds).toContain(testAccountId);
      expect(accountIds).toContain(account2.id);
    });
  });
});
