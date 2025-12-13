/**
 * Authorization Service
 * Handles permission checking and access control
 */
import { db } from './db';
import { logger } from './logger';
import { ForbiddenError, NotFoundError } from '../errors';

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
