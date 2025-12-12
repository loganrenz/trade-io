/**
 * Integration Tests for Audit Service
 * Tests actual database operations
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { auditService, AuditAction } from '~/server/lib/audit';
import { db } from '~/server/lib/db';

describe('AuditService Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for audit logging
    const user = await db.user.create({
      data: {
        email: `audit-test-${Date.now()}@example.com`,
        emailVerified: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up: Delete all audit logs and test user
    await db.auditLog.deleteMany({
      where: { actor: testUserId },
    });
    await db.user.delete({
      where: { id: testUserId },
    });
  });

  beforeEach(async () => {
    // Clean audit logs before each test
    await db.auditLog.deleteMany({
      where: { actor: testUserId },
    });
  });

  describe('log', () => {
    it('should create audit log entry in database', async () => {
      await auditService.log({
        actor: testUserId,
        action: AuditAction.USER_LOGIN,
        resource: 'user',
        resourceId: testUserId,
        metadata: { loginMethod: 'email' },
        requestId: crypto.randomUUID(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const logs = await db.auditLog.findMany({
        where: { actor: testUserId },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(AuditAction.USER_LOGIN);
      expect(logs[0].resource).toBe('user');
      expect(logs[0].resourceId).toBe(testUserId);
      expect(logs[0].metadata).toEqual({ loginMethod: 'email' });
    });

    it('should handle null values in database', async () => {
      await auditService.log({
        action: AuditAction.USER_LOGOUT,
        resource: 'user',
      });

      const logs = await db.auditLog.findMany({
        where: { action: AuditAction.USER_LOGOUT },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].actor).toBeNull();
      expect(logs[0].resourceId).toBeNull();
      expect(logs[0].metadata).toBeNull();
    });

    it('should create audit logs with timestamps', async () => {
      const beforeTime = new Date();

      await auditService.log({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
        resource: 'order',
      });

      const afterTime = new Date();

      const logs = await db.auditLog.findMany({
        where: { actor: testUserId },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });
  });

  describe('logBatch', () => {
    it('should create multiple audit logs in single transaction', async () => {
      const entries = [
        {
          actor: testUserId,
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          resourceId: crypto.randomUUID(),
        },
        {
          actor: testUserId,
          action: AuditAction.ORDER_FILLED,
          resource: 'order',
          resourceId: crypto.randomUUID(),
        },
        {
          actor: testUserId,
          action: AuditAction.POSITION_OPENED,
          resource: 'position',
          resourceId: crypto.randomUUID(),
        },
      ];

      await auditService.logBatch(entries);

      const logs = await db.auditLog.findMany({
        where: { actor: testUserId },
        orderBy: { timestamp: 'asc' },
      });

      expect(logs).toHaveLength(3);
      expect(logs[0].action).toBe(AuditAction.ORDER_PLACED);
      expect(logs[1].action).toBe(AuditAction.ORDER_FILLED);
      expect(logs[2].action).toBe(AuditAction.POSITION_OPENED);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Create test data
      const requestId = crypto.randomUUID();
      await auditService.logBatch([
        {
          actor: testUserId,
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          resourceId: crypto.randomUUID(),
          requestId,
        },
        {
          actor: testUserId,
          action: AuditAction.ORDER_FILLED,
          resource: 'order',
          resourceId: crypto.randomUUID(),
          requestId,
        },
        {
          actor: testUserId,
          action: AuditAction.ACCOUNT_CREATED,
          resource: 'account',
          resourceId: crypto.randomUUID(),
        },
      ]);
    });

    it('should query audit logs by actor', async () => {
      const result = await auditService.query({
        actor: testUserId,
      });

      expect(result.logs.length).toBeGreaterThanOrEqual(3);
      expect(result.total).toBeGreaterThanOrEqual(3);
    });

    it('should query audit logs by action', async () => {
      const result = await auditService.query({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe(AuditAction.ORDER_PLACED);
    });

    it('should query audit logs by resource', async () => {
      const result = await auditService.query({
        actor: testUserId,
        resource: 'order',
      });

      expect(result.logs).toHaveLength(2);
      expect(result.logs.every((log) => log.resource === 'order')).toBe(true);
    });

    it('should support pagination', async () => {
      const page1 = await auditService.query({
        actor: testUserId,
        limit: 2,
        offset: 0,
      });

      expect(page1.logs).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await auditService.query({
        actor: testUserId,
        limit: 2,
        offset: 2,
      });

      expect(page2.logs).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should order by timestamp descending', async () => {
      const result = await auditService.query({
        actor: testUserId,
      });

      for (let i = 1; i < result.logs.length; i++) {
        expect(
          result.logs[i - 1].timestamp.getTime()
        ).toBeGreaterThanOrEqual(result.logs[i].timestamp.getTime());
      }
    });
  });

  describe('getResourceHistory', () => {
    it('should get chronological history for a resource', async () => {
      const resourceId = crypto.randomUUID();

      // Create history in sequence
      await auditService.log({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
        resource: 'order',
        resourceId,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await auditService.log({
        actor: testUserId,
        action: AuditAction.ORDER_FILLED,
        resource: 'order',
        resourceId,
      });

      const history = await auditService.getResourceHistory('order', resourceId);

      expect(history).toHaveLength(2);
      expect(history[0].action).toBe(AuditAction.ORDER_PLACED);
      expect(history[1].action).toBe(AuditAction.ORDER_FILLED);
      expect(history[0].timestamp.getTime()).toBeLessThan(
        history[1].timestamp.getTime()
      );
    });

    it('should include user information', async () => {
      const resourceId = crypto.randomUUID();

      await auditService.log({
        actor: testUserId,
        action: AuditAction.ACCOUNT_CREATED,
        resource: 'account',
        resourceId,
      });

      const history = await auditService.getResourceHistory(
        'account',
        resourceId
      );

      expect(history).toHaveLength(1);
      expect(history[0].user).toBeDefined();
      expect(history[0].user?.id).toBe(testUserId);
      expect(history[0].user?.email).toContain('@example.com');
    });

    it('should return empty array for non-existent resource', async () => {
      const history = await auditService.getResourceHistory(
        'order',
        crypto.randomUUID()
      );

      expect(history).toHaveLength(0);
    });
  });

  describe('complex scenarios', () => {
    it('should handle concurrent audit logging', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        auditService.log({
          actor: testUserId,
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          resourceId: crypto.randomUUID(),
          metadata: { index: i },
        })
      );

      await Promise.all(promises);

      const result = await auditService.query({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
      });

      expect(result.logs).toHaveLength(10);
    });

    it('should preserve JSON metadata structure', async () => {
      const complexMetadata = {
        order: {
          symbol: 'AAPL',
          quantity: 100,
          price: 150.25,
        },
        timestamps: {
          created: new Date().toISOString(),
          submitted: new Date().toISOString(),
        },
        flags: {
          isMargin: false,
          isDayOrder: true,
        },
      };

      await auditService.log({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
        resource: 'order',
        metadata: complexMetadata,
      });

      const logs = await db.auditLog.findMany({
        where: {
          actor: testUserId,
          action: AuditAction.ORDER_PLACED,
        },
        orderBy: { timestamp: 'desc' },
        take: 1,
      });

      expect(logs[0].metadata).toEqual(complexMetadata);
    });
  });
});
