/**
 * tRPC Instance and Middleware
 * Base configuration for all tRPC procedures
 */
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import superjson from 'superjson';
import type { Context } from './context';
import { checkAccountAccess, checkOrderAccess, checkPositionAccess } from '~/server/lib/authz';
import { ForbiddenError, NotFoundError } from '~/server/errors';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Public procedure - no authentication required
 */
export const publicProcedure = t.procedure;

/**
 * Router builder
 */
export const router = t.router;

/**
 * Middleware builder
 */
export const middleware = t.middleware;

/**
 * Protected procedure - requires authentication
 */
const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Now type-safe as non-null
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

/**
 * Middleware to check account access
 */
const requireAccountAccess = middleware(async ({ ctx, next, input }) => {
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
 */
const requireOrderAccess = middleware(async ({ ctx, next, input }) => {
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
 */
const requirePositionAccess = middleware(async ({ ctx, next, input }) => {
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
 * Account-protected procedure - requires authentication and account access
 */
export const accountProtectedProcedure = protectedProcedure.use(requireAccountAccess);

/**
 * Order-protected procedure - requires authentication and order access
 */
export const orderProtectedProcedure = protectedProcedure.use(requireOrderAccess);

/**
 * Position-protected procedure - requires authentication and position access
 */
export const positionProtectedProcedure = protectedProcedure.use(requirePositionAccess);
