/**
 * Error Handler Utilities
 * Centralized error handling logic
 */
import { logger } from '../lib/logger';
import { AppError, InternalServerError } from './base';

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Handle application errors
 * Logs error and returns safe error response
 */
export function handleError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof AppError) {
    // Log operational errors at appropriate level
    const level = error.statusCode >= 500 ? 'error' : 'warn';
    logger[level](
      {
        error: error.toJSON(),
        stack: error.stack,
        ...context,
      },
      `Application error: ${error.message}`
    );

    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        ...(error.context && { details: error.context }),
      },
    };
  }

  // Unknown error - log as critical and return generic message
  logger.error(
    {
      error: error instanceof Error ? error : new Error(String(error)),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    },
    'Unexpected error occurred'
  );

  const internalError = new InternalServerError();
  return {
    error: {
      message: internalError.message,
      code: internalError.code,
      statusCode: internalError.statusCode,
    },
  };
}
