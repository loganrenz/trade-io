/**
 * Audit Service Tests
 * Validates audit logging functionality
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../server/lib/db';
import { audit, queryAuditLogs, AuditAction, AuditResource } from '../../server/lib/audit';

describe('Audit Service', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Clean up audit logs
    await db.auditLog.deleteMany();
    await db.user.deleteMany();

    // Create a test user
    const user = await db.user.create({
      data: {
        email: 'audit-test@example.com',
        emailVerified: true,
        provider: 'test',
        providerUserId: 'audit-test-123',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.auditLog.deleteMany();
    await db.user.deleteMany();
  });

  describe('audit()', () => {
    it('should create audit log entry with all fields', async () => {
      const requestId = '33333333-3333-3333-3333-333333333333';

      await audit({
        actor: testUserId,
        action: AuditAction.ORDER_PLACED,
        resource: AuditResource.ORDER,
        resourceId: '123e4567-e89b-12d3-a456-426614174000',
        metadata: { symbol: 'AAPL', quantity: 10 },
        requestId,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
      });

      const logs = await db.auditLog.findMany({
        where: {
          requestId,
        },
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      const log = logs[0];
      expect(log.actor).toBe(testUserId);
      expect(log.action).toBe(AuditAction.ORDER_PLACED);
      expect(log.resource).toBe(AuditResource.ORDER);
      expect(log.resourceId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(log.metadata).toEqual({ symbol: 'AAPL', quantity: 10 });
      expect(log.requestId).toBe(requestId);
      expect(log.ipAddress).toBe('192.168.1.1');
      expect(log.userAgent).toBe('Test Agent');
    });

    it('should create audit log entry without actor (system action)', async () => {
      const requestId = '44444444-4444-4444-4444-444444444444';

      await audit({
        action: AuditAction.SYSTEM_MAINTENANCE,
        resource: AuditResource.SYSTEM,
        metadata: { reason: 'scheduled maintenance' },
        requestId,
      });

      const logs = await db.auditLog.findMany({
        where: {
          requestId,
        },
        orderBy: { timestamp: 'desc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].actor).toBeNull();
      expect(logs[0].action).toBe(AuditAction.SYSTEM_MAINTENANCE);
    });

    it('should not throw error even if audit fails', async () => {
      // Try to audit with invalid actor ID (should not throw)
      await expect(
        audit({
          actor: 'invalid-uuid',
          action: AuditAction.ORDER_PLACED,
          resource: AuditResource.ORDER,
        })
      ).resolves.not.toThrow();
    });

    it('should handle metadata as JSON', async () => {
      const complexMetadata = {
        order: {
          symbol: 'TSLA',
          quantity: 100,
          price: 250.5,
        },
        account: {
          id: 'acc-123',
          name: 'Test Account',
        },
        nested: {
          deep: {
            value: true,
          },
        },
      };

      await audit({
        actor: testUserId,
        action: AuditAction.ORDER_MODIFIED,
        resource: AuditResource.ORDER,
        metadata: complexMetadata,
      });

      const logs = await db.auditLog.findMany({
        where: { action: AuditAction.ORDER_MODIFIED },
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].metadata).toEqual(complexMetadata);
    });
  });

  describe('queryAuditLogs()', () => {
    beforeAll(async () => {
      // Create multiple audit log entries for testing queries
      await db.auditLog.deleteMany();

      const orderId1 = '11111111-1111-1111-1111-111111111111';
      const accountId1 = '22222222-2222-2222-2222-222222222222';

      const entries = [
        {
          actor: testUserId,
          action: AuditAction.ORDER_PLACED,
          resource: AuditResource.ORDER,
          resourceId: orderId1,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          actor: testUserId,
          action: AuditAction.ORDER_FILLED,
          resource: AuditResource.ORDER,
          resourceId: orderId1,
          timestamp: new Date('2024-01-01T11:00:00Z'),
        },
        {
          actor: testUserId,
          action: AuditAction.ACCOUNT_CREATED,
          resource: AuditResource.ACCOUNT,
          resourceId: accountId1,
          timestamp: new Date('2024-01-02T10:00:00Z'),
        },
        {
          actor: null,
          action: AuditAction.SYSTEM_MAINTENANCE,
          resource: AuditResource.SYSTEM,
          timestamp: new Date('2024-01-03T10:00:00Z'),
        },
      ];

      for (const entry of entries) {
        await db.auditLog.create({
          data: {
            action: entry.action,
            resource: entry.resource,
            resourceId: entry.resourceId,
            timestamp: entry.timestamp,
            user: entry.actor
              ? {
                  connect: { id: entry.actor },
                }
              : undefined,
          },
        });
      }
    });

    it('should query all logs without filters', async () => {
      const result = await queryAuditLogs({});

      expect(result.total).toBeGreaterThanOrEqual(4);
      expect(result.logs.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter by actor', async () => {
      const result = await queryAuditLogs({ actor: testUserId });

      expect(result.total).toBe(3);
      expect(result.logs.every((log) => log.actor === testUserId)).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await queryAuditLogs({
        action: AuditAction.ORDER_PLACED,
      });

      expect(result.total).toBe(1);
      expect(result.logs[0].action).toBe(AuditAction.ORDER_PLACED);
    });

    it('should filter by resource', async () => {
      const result = await queryAuditLogs({ resource: AuditResource.ORDER });

      expect(result.total).toBe(2);
      expect(result.logs.every((log) => log.resource === 'order')).toBe(true);
    });

    it('should filter by resourceId', async () => {
      const orderId1 = '11111111-1111-1111-1111-111111111111';
      const result = await queryAuditLogs({ resourceId: orderId1 });

      expect(result.total).toBe(2);
      expect(result.logs.every((log) => log.resourceId === orderId1)).toBe(true);
    });

    it('should filter by date range', async () => {
      const result = await queryAuditLogs({
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-02T00:00:00Z'),
      });

      expect(result.total).toBe(2);
    });

    it('should support pagination', async () => {
      const page1 = await queryAuditLogs({ limit: 2, offset: 0 });
      const page2 = await queryAuditLogs({ limit: 2, offset: 2 });

      expect(page1.logs.length).toBeLessThanOrEqual(2);
      expect(page2.logs.length).toBeLessThanOrEqual(2);
      expect(page1.limit).toBe(2);
      expect(page1.offset).toBe(0);
      expect(page2.offset).toBe(2);
    });

    it('should order logs by timestamp descending', async () => {
      const result = await queryAuditLogs({});

      for (let i = 0; i < result.logs.length - 1; i++) {
        const current = new Date(result.logs[i].timestamp);
        const next = new Date(result.logs[i + 1].timestamp);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should include user information', async () => {
      const result = await queryAuditLogs({ actor: testUserId });

      const logsWithUser = result.logs.filter((log) => log.user);
      expect(logsWithUser.length).toBeGreaterThan(0);
      expect(logsWithUser[0].user?.email).toBe('audit-test@example.com');
    });
  });

  describe('Audit Constants', () => {
    it('should have defined audit actions', () => {
      expect(AuditAction.ORDER_PLACED).toBe('ORDER_PLACED');
      expect(AuditAction.ACCOUNT_CREATED).toBe('ACCOUNT_CREATED');
      expect(AuditAction.USER_LOGIN).toBe('USER_LOGIN');
    });

    it('should have defined audit resources', () => {
      expect(AuditResource.ORDER).toBe('order');
      expect(AuditResource.ACCOUNT).toBe('account');
      expect(AuditResource.USER).toBe('user');
    });
  });
});
