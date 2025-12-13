/**
 * tRPC Instance and Middleware
 * Base configuration for all tRPC procedures
 */
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import superjson from 'superjson';
import type { Context } from './context';
import {
  requireAccountAccess,
  requireOrderAccess,
  requirePositionAccess,
} from './middleware/authz';

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
 * Protected procedure - requires authentication
 */
const isAuthenticated = t.middleware(({ ctx, next }) => {
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
 * Account-protected procedure - requires authentication and account access
 * Input must include accountId field
 */
export const accountProtectedProcedure = protectedProcedure.use(requireAccountAccess);

/**
 * Order-protected procedure - requires authentication and order access
 * Input must include orderId field
 */
export const orderProtectedProcedure = protectedProcedure.use(requireOrderAccess);

/**
 * Position-protected procedure - requires authentication and position access
 * Input must include positionId field
 */
export const positionProtectedProcedure = protectedProcedure.use(requirePositionAccess);

/**
 * Router builder
 */
export const router = t.router;

/**
 * Middleware builder
 */
export const middleware = t.middleware;
