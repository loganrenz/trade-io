/**
 * Base Application Error
 * All custom errors should extend this class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.context && { context: this.context }),
    };
  }
}

/**
 * Validation Error (400)
 * Used when user input validation fails
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', 400, true, { ...context, field });
  }
}

/**
 * Authentication Error (401)
 * Used when user is not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'You must be logged in to access this resource') {
    super(message, 'AUTHENTICATION_ERROR', 401, true);
  }
}

/**
 * Authorization Error (403)
 * Used when user is authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'You do not have permission to access this resource') {
    super(message, 'FORBIDDEN', 403, true);
  }
}

/**
 * Not Found Error (404)
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, true, { resource, identifier });
  }
}

/**
 * Conflict Error (409)
 * Used when operation conflicts with current state
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, context);
  }
}

/**
 * Rate Limit Error (429)
 * Used when user exceeds rate limits
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests, please try again later',
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, { retryAfter });
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
export class InternalServerError extends AppError {
  constructor(
    message: string = 'An internal server error occurred',
    context?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, false, context);
  }
}

/**
 * Service Unavailable Error (503)
 * Used when external service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, message?: string) {
    super(message || `${service} is temporarily unavailable`, 'SERVICE_UNAVAILABLE', 503, true, {
      service,
    });
  }
}
