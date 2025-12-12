/**
 * Root tRPC Router
 * Combines all feature routers
 */
import { router } from '../trpc';
import { healthRouter } from './health';

export const appRouter = router({
  health: healthRouter,
  // Additional routers will be added here as features are implemented
  // users: usersRouter,
  // accounts: accountsRouter,
  // orders: ordersRouter,
  // positions: positionsRouter,
  // marketData: marketDataRouter,
});

export type AppRouter = typeof appRouter;
