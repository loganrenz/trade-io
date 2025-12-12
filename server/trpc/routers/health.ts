/**
 * Health Check Router
 * Provides system health and readiness endpoints
 */
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db } from '../../lib/db';

export const healthRouter = router({
  /**
   * Basic health check
   */
  check: publicProcedure.query(async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }),

  /**
   * Readiness check (includes database connectivity)
   */
  ready: publicProcedure.query(async ({ ctx }) => {
    try {
      // Check database connectivity
      await db.$queryRaw`SELECT 1`;

      return {
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      ctx.logger.error({ error }, 'Readiness check failed');
      return {
        status: 'not ready',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }),
});
