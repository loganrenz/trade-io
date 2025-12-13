/**
 * Root tRPC Router
 * Combines all feature routers
 */
import { router } from '../trpc';
import { healthRouter } from './health';
import { auditRouter } from './audit';
import { userRouter } from './user';
import { accountRouter } from './account';

export const appRouter = router({
  health: healthRouter,
  audit: auditRouter,
  user: userRouter,
  account: accountRouter,
  // Additional routers will be added here as features are implemented
  // orders: ordersRouter,
  // positions: positionsRouter,
  // marketData: marketDataRouter,
});

export type AppRouter = typeof appRouter;
