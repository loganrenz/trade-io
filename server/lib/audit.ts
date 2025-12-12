/**
 * Audit Logging Service
 * Production-grade audit trail for all state changes
 */
import { z } from 'zod';
import { db } from './db';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Audit log entry schema with validation
 */
export const auditLogEntrySchema = z.object({
  actor: z.string().uuid().nullable().optional(),
  action: z.string().max(100),
  resource: z.string().max(50),
  resourceId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  requestId: z.string().uuid().nullable().optional(),
  ipAddress: z.string().max(45).nullable().optional(),
  userAgent: z.string().nullable().optional(),
});

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

// ============================================================================
// COMMON AUDIT ACTIONS
// ============================================================================

export const AuditAction = {
  // User actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',

  // Account actions
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_ACTIVATED: 'ACCOUNT_ACTIVATED',

  // Order actions
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_MODIFIED: 'ORDER_MODIFIED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_FILLED: 'ORDER_FILLED',
  ORDER_REJECTED: 'ORDER_REJECTED',
  ORDER_EXPIRED: 'ORDER_EXPIRED',

  // Position actions
  POSITION_OPENED: 'POSITION_OPENED',
  POSITION_CLOSED: 'POSITION_CLOSED',
  POSITION_UPDATED: 'POSITION_UPDATED',

  // Ledger actions
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRADE_SETTLED: 'TRADE_SETTLED',
  FEE_CHARGED: 'FEE_CHARGED',
  ADJUSTMENT: 'ADJUSTMENT',

  // Security actions
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// ============================================================================
// AUDIT SERVICE
// ============================================================================

export class AuditService {
  /**
   * Create a new audit log entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Validate input
      const validated = auditLogEntrySchema.parse(entry);

      // Create audit log in database
      await db.auditLog.create({
        data: {
          actor: validated.actor ?? null,
          action: validated.action,
          resource: validated.resource,
          resourceId: validated.resourceId ?? null,
          metadata: validated.metadata as Prisma.InputJsonValue,
          requestId: validated.requestId ?? null,
          ipAddress: validated.ipAddress ?? null,
          userAgent: validated.userAgent ?? null,
        },
      });

      // Also log to application logger for immediate visibility
      logger.info(
        {
          auditLog: {
            actor: validated.actor,
            action: validated.action,
            resource: validated.resource,
            resourceId: validated.resourceId,
            requestId: validated.requestId,
          },
        },
        'Audit log created'
      );
    } catch (error) {
      // Critical: Audit logging failure should be logged but not throw
      // We don't want to fail user operations due to audit logging issues
      logger.error(
        {
          error,
          auditEntry: entry,
        },
        'Failed to create audit log'
      );
    }
  }

  /**
   * Create multiple audit log entries in a single transaction
   */
  async logBatch(entries: AuditLogEntry[]): Promise<void> {
    try {
      // Validate all entries
      const validated = entries.map((entry) =>
        auditLogEntrySchema.parse(entry)
      );

      // Create all logs in a single transaction
      await db.$transaction(
        validated.map((entry) =>
          db.auditLog.create({
            data: {
              actor: entry.actor ?? null,
              action: entry.action,
              resource: entry.resource,
              resourceId: entry.resourceId ?? null,
              metadata: entry.metadata as Prisma.InputJsonValue,
              requestId: entry.requestId ?? null,
              ipAddress: entry.ipAddress ?? null,
              userAgent: entry.userAgent ?? null,
            },
          })
        )
      );

      logger.info({ count: validated.length }, 'Batch audit logs created');
    } catch (error) {
      logger.error(
        {
          error,
          count: entries.length,
        },
        'Failed to create batch audit logs'
      );
    }
  }

  /**
   * Query audit logs with filtering
   */
  async query(params: {
    actor?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    requestId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const {
      actor,
      action,
      resource,
      resourceId,
      requestId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = params;

    const where: Prisma.AuditLogWhereInput = {};

    if (actor) where.actor = actor;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (requestId) where.requestId = requestId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      limit,
      offset,
      hasMore: total > offset + logs.length,
    };
  }

  /**
   * Get audit trail for a specific resource
   */
  async getResourceHistory(resource: string, resourceId: string) {
    return db.auditLog.findMany({
      where: {
        resource,
        resourceId,
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
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const auditService = new AuditService();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create audit log for user action with context
 */
export async function auditUserAction(
  action: AuditActionType,
  resource: string,
  resourceId: string | null,
  context: {
    userId: string | null;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await auditService.log({
    actor: context.userId ?? null,
    action,
    resource,
    resourceId: resourceId ?? null,
    metadata: context.metadata ?? null,
    requestId: context.requestId ?? null,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  });
}

/**
 * Create audit log from tRPC context
 */
export async function auditFromContext(
  action: AuditActionType,
  resource: string,
  resourceId: string | null,
  context: {
    userId: string | null;
    requestId: string;
    ipAddress?: string;
    userAgent?: string;
  },
  metadata?: Record<string, unknown>
) {
  await auditService.log({
    actor: context.userId,
    action,
    resource,
    resourceId,
    metadata: metadata ?? null,
    requestId: context.requestId,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  });
}
