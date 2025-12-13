/**
 * Root tRPC Router
 * Combines all feature routers
 */
import { router } from '../trpc';
import { healthRouter } from './health';
import { auditRouter } from './audit';
import { userRouter } from './user';
import { accountRouter } from './account';
import { instrumentRouter } from './instrument';
import { quoteRouter } from './quote';
import { barRouter } from './bar';

export const appRouter = router({
  health: healthRouter,
  audit: auditRouter,
  user: userRouter,
  account: accountRouter,
  instrument: instrumentRouter,
  quote: quoteRouter,
  bar: barRouter,
  // Additional routers will be added here as features are implemented
  // orders: ordersRouter,
  // positions: positionsRouter,
});

export type AppRouter = typeof appRouter;
