/**
 * Error Classes Export
 * Central export for all application errors
 */

// Base errors
export {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
} from './base';

// Business errors
export {
  InsufficientFundsError,
  InvalidOrderError,
  InvalidSymbolError,
  MarketClosedError,
  PositionLimitError,
  ConcurrencyError,
  IdempotencyError,
} from './business';

// Error handler utility
export { handleError, isOperationalError } from './handler';
