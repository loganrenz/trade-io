/**
 * Audit Log Service
 * Provides immutable audit trail for all state-changing operations
 */
import { db } from './db';
import { logger } from './logger';
import type { Prisma } from '@prisma/client';

export interface AuditLogEntry {
  actor?: string; // User ID who performed the action
  action: string; // Action type (e.g., 'ORDER_PLACED', 'ACCOUNT_CREATED')
  resource: string; // Resource type (e.g., 'order', 'account')
  resourceId?: string; // ID of the affected resource
  metadata?: Record<string, unknown>; // Additional context
  requestId?: string; // For request correlation
  ipAddress?: string; // Client IP address
  userAgent?: string; // Client user agent
}

/**
 * Create an audit log entry
 * This function never throws - failures are logged but don't block operations
 */
export async function audit(entry: AuditLogEntry): Promise<void> {
  try {
    const data: Prisma.AuditLogCreateInput = {
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      metadata: entry.metadata as Prisma.InputJsonValue,
      requestId: entry.requestId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      user: entry.actor
        ? {
            connect: {
              id: entry.actor,
            },
          }
        : undefined,
    };

    await db.auditLog.create({ data });

    logger.debug(
      {
        actor: entry.actor,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
      },
      'Audit log created'
    );
  } catch (error) {
    // NEVER let audit logging failure break the main operation
    // But log the error for investigation
    logger.error(
      {
        error,
        entry,
      },
      'Failed to create audit log entry'
    );
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
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
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.actor) where.actor = filters.actor;
  if (filters.action) where.action = filters.action;
  if (filters.resource) where.resource = filters.resource;
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.requestId) where.requestId = filters.requestId;

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) where.timestamp.gte = filters.startDate;
    if (filters.endDate) where.timestamp.lte = filters.endDate;
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    total,
    logs,
    limit: filters.limit ?? 100,
    offset: filters.offset ?? 0,
  };
}

/**
 * Audit action types - centralized constants
 */
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
  ACCOUNT_REACTIVATED: 'ACCOUNT_REACTIVATED',

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
  POSITION_MODIFIED: 'POSITION_MODIFIED',

  // Ledger actions
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  TRANSFER: 'TRANSFER',
  ADJUSTMENT: 'ADJUSTMENT',

  // Risk actions
  RISK_LIMIT_UPDATED: 'RISK_LIMIT_UPDATED',
  SYMBOL_RESTRICTED: 'SYMBOL_RESTRICTED',
  SYMBOL_UNRESTRICTED: 'SYMBOL_UNRESTRICTED',

  // System actions
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
} as const;

/**
 * Audit resource types - centralized constants
 */
export const AuditResource = {
  USER: 'user',
  ACCOUNT: 'account',
  ORDER: 'order',
  EXECUTION: 'execution',
  POSITION: 'position',
  LEDGER_ENTRY: 'ledger_entry',
  INSTRUMENT: 'instrument',
  RISK_LIMIT: 'risk_limit',
  SYMBOL_RESTRICTION: 'symbol_restriction',
  SYSTEM: 'system',
} as const;
