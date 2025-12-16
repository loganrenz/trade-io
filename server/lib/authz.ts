/**
 * Authorization Service
 * Handles permission checking and access control
 */
import { db } from './db';
import { logger } from './logger';
import { ForbiddenError, NotFoundError } from '../errors';

/**
 * User roles in the system
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

/**
 * Permissions required for admin operations
 */
export const ADMIN_PERMISSIONS = {
  MANAGE_USERS: 'MANAGE_USERS',
  MANAGE_RISK_LIMITS: 'MANAGE_RISK_LIMITS',
  MANAGE_SYMBOL_RESTRICTIONS: 'MANAGE_SYMBOL_RESTRICTIONS',
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  VIEW_SYSTEM_METRICS: 'VIEW_SYSTEM_METRICS',
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

/**
 * Check if a user has access to an account
 * @throws {ForbiddenError} if user does not have access
 * @throws {NotFoundError} if account does not exist
 */
export async function checkAccountAccess(userId: string, accountId: string): Promise<void> {
  const account = await db.account.findFirst({
    where: {
      id: accountId,
      deletedAt: null,
    },
  });

  if (!account) {
    throw new NotFoundError('Account', accountId);
  }

  if (account.ownerId !== userId) {
    logger.warn(
      { userId, accountId, ownerId: account.ownerId },
      'Access denied: user is not account owner'
    );
    throw new ForbiddenError('You do not have permission to access this account');
  }
}

/**
 * Verify if a user owns an account (returns boolean instead of throwing)
 */
export async function isAccountOwner(userId: string, accountId: string): Promise<boolean> {
  const account = await db.account.findFirst({
    where: {
      id: accountId,
      ownerId: userId,
      deletedAt: null,
    },
  });

  return account !== null;
}

/**
 * Get all account IDs that a user has access to
 */
export async function getUserAccountIds(userId: string): Promise<string[]> {
  const accounts = await db.account.findMany({
    where: {
      ownerId: userId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return accounts.map((acc) => acc.id);
}

/**
 * Check if a user has access to an order
 * @throws {ForbiddenError} if user does not have access
 * @throws {NotFoundError} if order does not exist
 */
export async function checkOrderAccess(userId: string, orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { account: true },
  });

  if (!order) {
    throw new NotFoundError('Order', orderId);
  }

  if (order.account.ownerId !== userId) {
    logger.warn(
      { userId, orderId, ownerId: order.account.ownerId },
      'Access denied: user does not own order account'
    );
    throw new ForbiddenError('You do not have permission to access this order');
  }
}

/**
 * Check if a user has access to a position
 * @throws {ForbiddenError} if user does not have access
 * @throws {NotFoundError} if position does not exist
 */
export async function checkPositionAccess(userId: string, positionId: string): Promise<void> {
  const position = await db.position.findUnique({
    where: { id: positionId },
    include: { account: true },
  });

  if (!position) {
    throw new NotFoundError('Position', positionId);
  }

  if (position.account.ownerId !== userId) {
    logger.warn(
      { userId, positionId, ownerId: position.account.ownerId },
      'Access denied: user does not own position account'
    );
    throw new ForbiddenError('You do not have permission to access this position');
  }
}

/**
 * Filter query to only include resources the user owns
 * Returns a Prisma where clause for account-related queries
 */
export function accountOwnerFilter(userId: string) {
  return {
    account: {
      ownerId: userId,
      deletedAt: null,
    },
  };
}

/**
 * Filter query to only include user's own accounts
 */
export function userAccountsFilter(userId: string) {
  return {
    ownerId: userId,
    deletedAt: null,
  };
}

/**
 * Check if a user has admin role
 * @throws {ForbiddenError} if user is not an admin
 * @throws {NotFoundError} if user does not exist
 */
export async function checkAdminAccess(userId: string): Promise<void> {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  if (user.role !== UserRole.ADMIN) {
    logger.warn({ userId, userRole: user.role }, 'Access denied: user is not an admin');
    throw new ForbiddenError('Admin access required');
  }
}

/**
 * Check if a user is an admin (returns boolean instead of throwing)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      role: UserRole.ADMIN,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return user !== null;
}

/**
 * Check if a user has a specific admin permission
 * In the future, this could support more granular role-based permissions
 * For now, all admins have all permissions
 */
export async function checkAdminPermission(
  userId: string,
  permission: AdminPermission
): Promise<void> {
  // For now, just check if user is admin
  // In the future, we could have a permissions table for fine-grained control
  await checkAdminAccess(userId);

  logger.debug({ userId, permission }, 'Admin permission check passed');
}

/**
 * Get user role
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      role: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  return user.role as UserRole;
}
