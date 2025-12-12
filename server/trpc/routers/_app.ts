/**
 * Root tRPC Router
 * Combines all feature routers
 */
import { router } from '../trpc';
import { healthRouter } from './health';
import { auditRouter } from './audit';

export const appRouter = router({
  health: healthRouter,
  audit: auditRouter,
  // Additional routers will be added here as features are implemented
  // users: usersRouter,
  // accounts: accountsRouter,
  // orders: ordersRouter,
  // positions: positionsRouter,
  // marketData: marketDataRouter,
});

export type AppRouter = typeof appRouter;
