/**
 * Authorization Middleware for tRPC
 * Provides authorization checks for protected procedures
 */
import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import { checkAccountAccess, checkOrderAccess, checkPositionAccess } from '~/server/lib/authz';
import { ForbiddenError, NotFoundError } from '~/server/errors';

/**
 * Middleware to check account access
 * Requires input to have an `accountId` field
 *
 * Usage:
 * ```typescript
 * export const accountProtectedProcedure = protectedProcedure.use(requireAccountAccess);
 *
 * // In router:
 * getAccount: accountProtectedProcedure
 *   .input(z.object({ accountId: z.string().uuid() }))
 *   .query(async ({ input, ctx }) => {
 *     // User's access to accountId has been verified
 *     return db.account.findUnique({ where: { id: input.accountId } });
 *   })
 * ```
 */
export const requireAccountAccess = middleware(async ({ ctx, next, input }) => {
  // Extract accountId from input
  const accountId =
    input && typeof input === 'object' && 'accountId' in input
      ? (input as { accountId: unknown }).accountId
      : null;

  if (!accountId || typeof accountId !== 'string') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'accountId is required in input',
    });
  }

  // ctx.userId is guaranteed to exist because this middleware
  // should be used after isAuthenticated middleware
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  try {
    await checkAccountAccess(ctx.userId, accountId);
    return next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: error.message,
      });
    }
    if (error instanceof NotFoundError) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: error.message,
      });
    }
    throw error;
  }
});

/**
 * Middleware to check order access
 * Requires input to have an `orderId` field
 *
 * Usage:
 * ```typescript
 * export const orderProtectedProcedure = protectedProcedure.use(requireOrderAccess);
 * ```
 */
export const requireOrderAccess = middleware(async ({ ctx, next, input }) => {
  const orderId =
    input && typeof input === 'object' && 'orderId' in input
      ? (input as { orderId: unknown }).orderId
      : null;

  if (!orderId || typeof orderId !== 'string') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'orderId is required in input',
    });
  }

  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  try {
    await checkOrderAccess(ctx.userId, orderId);
    return next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: error.message,
      });
    }
    if (error instanceof NotFoundError) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: error.message,
      });
    }
    throw error;
  }
});

/**
 * Middleware to check position access
 * Requires input to have a `positionId` field
 *
 * Usage:
 * ```typescript
 * export const positionProtectedProcedure = protectedProcedure.use(requirePositionAccess);
 * ```
 */
export const requirePositionAccess = middleware(async ({ ctx, next, input }) => {
  const positionId =
    input && typeof input === 'object' && 'positionId' in input
      ? (input as { positionId: unknown }).positionId
      : null;

  if (!positionId || typeof positionId !== 'string') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'positionId is required in input',
    });
  }

  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  try {
    await checkPositionAccess(ctx.userId, positionId);
    return next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: error.message,
      });
    }
    if (error instanceof NotFoundError) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: error.message,
      });
    }
    throw error;
  }
});

/**
 * Generic authorization middleware factory
 * Creates a middleware that checks access using a custom validation function
 *
 * Usage:
 * ```typescript
 * const requireCustomAccess = createAuthzMiddleware({
 *   getResourceId: (input) => input.customId,
 *   checkAccess: async (userId, resourceId) => {
 *     // Custom access check logic
 *     const resource = await db.customResource.findUnique({ where: { id: resourceId } });
 *     if (!resource || resource.ownerId !== userId) {
 *       throw new ForbiddenError('Access denied');
 *     }
 *   },
 * });
 * ```
 */
export function createAuthzMiddleware<T>(config: {
  getResourceId: (input: T) => string | null;
  checkAccess: (userId: string, resourceId: string) => Promise<void>;
  resourceIdFieldName?: string;
}) {
  return middleware(async ({ ctx, next, input }) => {
    const resourceId = config.getResourceId(input as T);

    if (!resourceId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${config.resourceIdFieldName || 'resourceId'} is required in input`,
      });
    }

    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to access this resource',
      });
    }

    try {
      await config.checkAccess(ctx.userId, resourceId);
      return next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: error.message,
        });
      }
      if (error instanceof NotFoundError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
        });
      }
      throw error;
    }
  });
}
