/**
 * Business Logic Errors
 * Domain-specific errors for trading operations
 */
import { AppError } from './base';

/**
 * Insufficient Funds Error
 * Used when account lacks sufficient cash for operation
 */
export class InsufficientFundsError extends AppError {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(
      `Insufficient funds: required $${required.toFixed(2)}, available $${available.toFixed(2)}`,
      'INSUFFICIENT_FUNDS',
      400,
      true,
      { required, available }
    );
  }
}

/**
 * Invalid Order Error
 * Used when order parameters are invalid for business rules
 */
export class InvalidOrderError extends AppError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(`Invalid order: ${reason}`, 'INVALID_ORDER', 400, true, context);
  }
}

/**
 * Invalid Symbol Error
 * Used when trading symbol is not valid or tradeable
 */
export class InvalidSymbolError extends AppError {
  constructor(public readonly symbol: string, reason?: string) {
    super(
      reason ? `Invalid symbol ${symbol}: ${reason}` : `Invalid symbol: ${symbol}`,
      'INVALID_SYMBOL',
      400,
      true,
      { symbol, reason }
    );
  }
}

/**
 * Market Closed Error
 * Used when attempting to trade outside market hours
 */
export class MarketClosedError extends AppError {
  constructor(message: string = 'Market is currently closed for trading') {
    super(message, 'MARKET_CLOSED', 400, true);
  }
}

/**
 * Position Limit Error
 * Used when position size exceeds limits
 */
export class PositionLimitError extends AppError {
  constructor(
    public readonly symbol: string,
    public readonly requested: number,
    public readonly limit: number
  ) {
    super(
      `Position limit exceeded for ${symbol}: requested ${requested}, limit ${limit}`,
      'POSITION_LIMIT_EXCEEDED',
      400,
      true,
      { symbol, requested, limit }
    );
  }
}

/**
 * Concurrency Error
 * Used when optimistic locking fails
 */
export class ConcurrencyError extends AppError {
  constructor(resource: string) {
    super(
      `${resource} was modified by another request. Please retry.`,
      'CONCURRENCY_ERROR',
      409,
      true,
      { resource }
    );
  }
}

/**
 * Idempotency Error
 * Used when duplicate idempotency key detected
 */
export class IdempotencyError extends AppError {
  constructor(
    public readonly idempotencyKey: string,
    public readonly existingResourceId: string
  ) {
    super(
      'Request already processed',
      'IDEMPOTENCY_KEY_REUSED',
      409,
      true,
      { idempotencyKey, existingResourceId }
    );
  }
}
