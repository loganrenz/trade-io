/**
 * Audit Logging Middleware for tRPC
 * Automatically logs API calls based on configuration
 */
import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import { auditService } from '~/server/lib/audit';

/**
 * Middleware to audit tRPC procedure calls
 * 
 * Usage:
 * ```typescript
 * export const auditedProcedure = publicProcedure.use(auditMiddleware({
 *   action: 'ORDER_PLACED',
 *   resource: 'order',
 *   getResourceId: (input) => input.orderId,
 *   includeInput: true,
 * }));
 * ```
 */
export function auditMiddleware(config: {
  action: string;
  resource: string;
  getResourceId?: (input: unknown) => string | null;
  includeInput?: boolean;
  includeOutput?: boolean;
}) {
  return middleware(async ({ ctx, next, path, type, input }) => {
    const startTime = Date.now();
    let error: unknown = null;
    let output: unknown = null;

    try {
      const result = await next();
      output = result.data;
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      // Log audit entry after procedure completes (success or failure)
      const duration = Date.now() - startTime;
      const resourceId = config.getResourceId
        ? config.getResourceId(input)
        : null;

      const metadata: Record<string, unknown> = {
        path,
        type,
        duration,
        success: error === null,
      };

      if (config.includeInput && input) {
        metadata.input = input;
      }

      if (config.includeOutput && output && error === null) {
        metadata.output = output;
      }

      if (error) {
        metadata.error = {
          message: error instanceof Error ? error.message : 'Unknown error',
          code:
            error instanceof TRPCError ? error.code : 'INTERNAL_SERVER_ERROR',
        };
      }

      await auditService.log({
        actor: ctx.userId,
        action: config.action,
        resource: config.resource,
        resourceId,
        metadata,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }
  });
}

/**
 * Simple audit middleware that just logs the procedure call
 */
export const simpleAuditMiddleware = middleware(async ({ ctx, next, path }) => {
  const result = await next();

  // Only audit successful calls
  await auditService.log({
    actor: ctx.userId,
    action: `API_CALL_${path.toUpperCase().replace(/\./g, '_')}`,
    resource: 'api',
    resourceId: null,
    metadata: { path },
    requestId: ctx.requestId,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });

  return result;
});
