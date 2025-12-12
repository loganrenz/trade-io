/**
 * Audit Logs tRPC Router
 * API endpoints for querying audit logs (admin use)
 */
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { auditService } from '~/server/lib/audit';
// import { ForbiddenError } from '~/server/errors'; // TODO: Use when auth is implemented

export const auditRouter = router({
  /**
   * Query audit logs with filters
   * TODO: Add admin authorization check when auth is implemented
   */
  query: publicProcedure
    .input(
      z.object({
        actor: z.string().uuid().optional(),
        action: z.string().optional(),
        resource: z.string().optional(),
        resourceId: z.string().uuid().optional(),
        requestId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      // TODO: Check if user is admin
      // if (!ctx.isAdmin) {
      //   throw new ForbiddenError('Only admins can query audit logs');
      // }

      return auditService.query({
        actor: input.actor,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        requestId: input.requestId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get audit trail for a specific resource
   * TODO: Add authorization check to ensure user has access to the resource
   */
  getResourceHistory: publicProcedure
    .input(
      z.object({
        resource: z.string(),
        resourceId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      // TODO: Verify user has permission to view this resource
      // e.g., if resource is 'order', check if order belongs to user's account

      return auditService.getResourceHistory(input.resource, input.resourceId);
    }),
});
