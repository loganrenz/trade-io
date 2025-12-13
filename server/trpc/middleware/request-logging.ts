/**
 * Request Logging Middleware for tRPC
 * Logs all API requests with timing and metadata
 */
import { middleware } from '../trpc';

/**
 * Log all tRPC requests
 */
export const requestLoggingMiddleware = middleware(async ({ ctx, next, path, type }) => {
  const startTime = Date.now();

  ctx.logger.info(
    {
      path,
      type,
      userId: ctx.userId,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    },
    'Request started'
  );

  try {
    const result = await next();
    const duration = Date.now() - startTime;

    ctx.logger.info(
      {
        path,
        type,
        userId: ctx.userId,
        requestId: ctx.requestId,
        duration,
        success: true,
      },
      'Request completed'
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    ctx.logger.error(
      {
        path,
        type,
        userId: ctx.userId,
        requestId: ctx.requestId,
        duration,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : error,
        success: false,
      },
      'Request failed'
    );

    throw error;
  }
});
