/**
 * Idempotency Support
 * Ensures write operations can be safely retried
 */
import { db } from '../../lib/db';
import { logger } from '../../lib/logger';

interface IdempotencyResult<T> {
  isRetry: boolean;
  result: T;
}

/**
 * Execute operation with idempotency support
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>
): Promise<IdempotencyResult<T>> {
  // Check if this operation was already executed
  const existing = await checkIdempotencyKey(key);

  if (existing) {
    logger.debug({ key }, 'Idempotent request detected, returning cached result');
    return {
      isRetry: true,
      result: existing as T,
    };
  }

  // Execute operation
  const result = await operation();

  // Store result for future idempotency checks
  await storeIdempotencyResult(key, result);

  return {
    isRetry: false,
    result,
  };
}

/**
 * Check if idempotency key exists
 */
async function checkIdempotencyKey(key: string): Promise<unknown | null> {
  try {
    // For orders, check idempotency key in order table
    const order = await db.order.findUnique({
      where: { idempotencyKey: key },
    });

    return order;
  } catch (error) {
    logger.error({ error, key }, 'Failed to check idempotency key');
    return null;
  }
}

/**
 * Store idempotency result
 */
async function storeIdempotencyResult(key: string, _result: unknown): Promise<void> {
  // Result is already stored as part of the operation
  // (e.g., order creation includes idempotencyKey)
  // This is a placeholder for future generic idempotency storage
  logger.debug({ key }, 'Idempotency result stored');
}

/**
 * Generate idempotency key from request
 */
export function generateIdempotencyKey(
  userId: string,
  operation: string,
  params: Record<string, unknown>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  return `${userId}:${operation}:${sortedParams}`;
}
