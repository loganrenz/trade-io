/**
 * Error Response Formatting
 * Standardized error response structure for API
 */
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  AuthenticationError,
  ConflictError,
  RateLimitError,
} from '../errors';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp: string;
}

/**
 * Convert application errors to tRPC errors
 */
export function toTRPCError(error: unknown): TRPCError {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      cause: error,
    });
  }

  // Handle application errors
  if (error instanceof ValidationError) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof AuthenticationError) {
    return new TRPCError({
      code: 'UNAUTHORIZED',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ForbiddenError) {
    return new TRPCError({
      code: 'FORBIDDEN',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof NotFoundError) {
    return new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ConflictError) {
    return new TRPCError({
      code: 'CONFLICT',
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof RateLimitError) {
    return new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: error.message,
      cause: error,
    });
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      cause: error,
    });
  }

  // Unknown error type
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}

/**
 * Format error for logging (includes sensitive details)
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof TRPCError && { code: error.code }),
      ...(error instanceof ZodError && { issues: error.issues }),
    };
  }

  return {
    error: String(error),
  };
}

/**
 * Format error for client (excludes sensitive details)
 */
export function formatErrorForClient(error: unknown): ErrorResponse {
  const timestamp = new Date().toISOString();

  if (error instanceof TRPCError) {
    return {
      code: error.code,
      message: error.message,
      timestamp,
    };
  }

  if (error instanceof ZodError) {
    return {
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      details: error.flatten(),
      timestamp,
    };
  }

  if (error instanceof ValidationError) {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
      timestamp,
    };
  }

  if (error instanceof NotFoundError) {
    return {
      code: 'NOT_FOUND',
      message: error.message,
      timestamp,
    };
  }

  // Generic error - don't leak internal details
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    timestamp,
  };
}
