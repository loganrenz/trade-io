/**
 * Unit Tests for Audit Service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auditService, AuditAction, auditLogEntrySchema } from '~/server/lib/audit';

// Mock the database
vi.mock('~/server/lib/db', () => ({
  db: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock the logger
vi.mock('~/server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { db } from '~/server/lib/db';

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log', () => {
    it('should create audit log with valid entry', async () => {
      const entry = {
        actor: '123e4567-e89b-12d3-a456-426614174000',
        action: AuditAction.ORDER_PLACED,
        resource: 'order',
        resourceId: '123e4567-e89b-12d3-a456-426614174001',
        metadata: { symbol: 'AAPL', quantity: 10 },
        requestId: '123e4567-e89b-12d3-a456-426614174002',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      vi.mocked(db.auditLog.create).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174003',
        timestamp: new Date(),
        ...entry,
      } as any);

      await auditService.log(entry);

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor: entry.actor,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: entry.metadata,
          requestId: entry.requestId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        }),
      });
    });

    it('should handle null values correctly', async () => {
      const entry = {
        actor: null,
        action: AuditAction.USER_LOGIN,
        resource: 'user',
        resourceId: null,
        metadata: null,
        requestId: null,
        ipAddress: null,
        userAgent: null,
      };

      vi.mocked(db.auditLog.create).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174003',
        timestamp: new Date(),
        ...entry,
      } as any);

      await auditService.log(entry);

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor: null,
          action: entry.action,
          resource: entry.resource,
          resourceId: null,
          metadata: null,
          requestId: null,
          ipAddress: null,
          userAgent: null,
        }),
      });
    });

    it('should not throw error when database fails', async () => {
      const entry = {
        action: AuditAction.ORDER_PLACED,
        resource: 'order',
      };

      vi.mocked(db.auditLog.create).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(auditService.log(entry)).resolves.toBeUndefined();
    });

    it('should validate input with Zod schema', async () => {
      const invalidEntry = {
        action: 'A'.repeat(101), // Exceeds max length
        resource: 'order',
      };

      vi.mocked(db.auditLog.create).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174003',
        timestamp: new Date(),
        action: '',
        resource: '',
        actor: null,
        resourceId: null,
        metadata: null,
        requestId: null,
        ipAddress: null,
        userAgent: null,
      } as any);

      // Should not throw, but should log error
      await auditService.log(invalidEntry as any);

      // Database should not be called due to validation failure
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('logBatch', () => {
    it('should create multiple audit logs in transaction', async () => {
      const entries = [
        {
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          resourceId: '123e4567-e89b-12d3-a456-426614174001',
        },
        {
          action: AuditAction.ORDER_FILLED,
          resource: 'order',
          resourceId: '123e4567-e89b-12d3-a456-426614174002',
        },
      ];

      vi.mocked(db.$transaction).mockResolvedValue([
        { id: '1', timestamp: new Date() },
        { id: '2', timestamp: new Date() },
      ] as any);

      await auditService.logBatch(entries);

      expect(db.$transaction).toHaveBeenCalled();
    });

    it('should handle batch logging failure gracefully', async () => {
      const entries = [
        {
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
        },
      ];

      vi.mocked(db.$transaction).mockRejectedValue(
        new Error('Transaction failed')
      );

      // Should not throw
      await expect(auditService.logBatch(entries)).resolves.toBeUndefined();
    });
  });

  describe('query', () => {
    it('should query audit logs with filters', async () => {
      const mockLogs = [
        {
          id: '1',
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          timestamp: new Date(),
        },
      ];

      vi.mocked(db.auditLog.findMany).mockResolvedValue(mockLogs as any);
      vi.mocked(db.auditLog.count).mockResolvedValue(1);

      const result = await auditService.query({
        actor: '123e4567-e89b-12d3-a456-426614174000',
        action: AuditAction.ORDER_PLACED,
        limit: 10,
        offset: 0,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);

      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          actor: '123e4567-e89b-12d3-a456-426614174000',
          action: AuditAction.ORDER_PLACED,
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should handle date range filtering', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-12-31');

      vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.count).mockResolvedValue(0);

      await auditService.query({
        startDate,
        endDate,
      });

      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
      });
    });

    it('should calculate hasMore correctly', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue(
        Array(10).fill({ id: '1' }) as any
      );
      vi.mocked(db.auditLog.count).mockResolvedValue(25);

      const result = await auditService.query({
        limit: 10,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(25);
    });
  });

  describe('getResourceHistory', () => {
    it('should get audit trail for specific resource', async () => {
      const mockHistory = [
        {
          id: '1',
          action: AuditAction.ORDER_PLACED,
          resource: 'order',
          resourceId: '123e4567-e89b-12d3-a456-426614174001',
          timestamp: new Date('2025-01-01'),
          user: { id: 'user1', email: 'user@example.com' },
        },
        {
          id: '2',
          action: AuditAction.ORDER_FILLED,
          resource: 'order',
          resourceId: '123e4567-e89b-12d3-a456-426614174001',
          timestamp: new Date('2025-01-02'),
          user: { id: 'user1', email: 'user@example.com' },
        },
      ];

      vi.mocked(db.auditLog.findMany).mockResolvedValue(mockHistory as any);

      const result = await auditService.getResourceHistory(
        'order',
        '123e4567-e89b-12d3-a456-426614174001'
      );

      expect(result).toEqual(mockHistory);
      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          resource: 'order',
          resourceId: '123e4567-e89b-12d3-a456-426614174001',
        },
        orderBy: { timestamp: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    });
  });
});

describe('auditLogEntrySchema', () => {
  it('should validate correct audit log entry', () => {
    const validEntry = {
      actor: '123e4567-e89b-12d3-a456-426614174000',
      action: 'ORDER_PLACED',
      resource: 'order',
      resourceId: '123e4567-e89b-12d3-a456-426614174001',
      metadata: { key: 'value' },
      requestId: '123e4567-e89b-12d3-a456-426614174002',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    const result = auditLogEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it('should accept null and optional fields', () => {
    const minimalEntry = {
      action: 'ORDER_PLACED',
      resource: 'order',
    };

    const result = auditLogEntrySchema.safeParse(minimalEntry);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUIDs', () => {
    const invalidEntry = {
      actor: 'not-a-uuid',
      action: 'ORDER_PLACED',
      resource: 'order',
    };

    const result = auditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('should reject action exceeding max length', () => {
    const invalidEntry = {
      action: 'A'.repeat(101),
      resource: 'order',
    };

    const result = auditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });

  it('should reject resource exceeding max length', () => {
    const invalidEntry = {
      action: 'ORDER_PLACED',
      resource: 'R'.repeat(51),
    };

    const result = auditLogEntrySchema.safeParse(invalidEntry);
    expect(result.success).toBe(false);
  });
});

describe('AuditAction constants', () => {
  it('should have all required action types', () => {
    expect(AuditAction.USER_CREATED).toBe('USER_CREATED');
    expect(AuditAction.ORDER_PLACED).toBe('ORDER_PLACED');
    expect(AuditAction.ACCOUNT_CREATED).toBe('ACCOUNT_CREATED');
    expect(AuditAction.POSITION_OPENED).toBe('POSITION_OPENED');
    expect(AuditAction.DEPOSIT).toBe('DEPOSIT');
    expect(AuditAction.UNAUTHORIZED_ACCESS).toBe('UNAUTHORIZED_ACCESS');
  });
});
