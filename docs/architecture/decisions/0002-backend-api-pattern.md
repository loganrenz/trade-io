# ADR 0002: Backend API Pattern Selection

## Status

**Accepted** - 2025-12-12

## Context

We need to choose an API pattern for communication between frontend and backend. Requirements include:

- **Type safety**: End-to-end type safety from database to UI
- **Developer experience**: Minimal boilerplate, clear errors
- **Performance**: Efficient data transfer, request batching
- **Real-time capabilities**: Support for subscriptions (order updates, price feeds)
- **Authentication**: Easy integration with auth providers
- **Validation**: Input validation with runtime type checking
- **Documentation**: Auto-generated or type-inferred API contracts

The platform will have dozens of endpoints across multiple domains (users, accounts, orders, positions, market data, admin).

## Decision

**We will use tRPC as our API pattern.**

## Rationale

### Why tRPC

1. **End-to-end type safety**: TypeScript types automatically shared between client and server
2. **No code generation**: Types inferred directly from backend procedures
3. **Excellent DX**: Autocomplete, type errors, and refactoring support in IDE
4. **Validation built-in**: Zod schemas for runtime validation
5. **Request batching**: Multiple requests automatically batched into single HTTP call
6. **Subscriptions**: WebSocket support for real-time updates
7. **Middleware support**: Easy to add auth, logging, error handling
8. **Framework agnostic**: Works with Express, Fastify, or standalone
9. **Perfect for TypeScript monorepos**: Shared types without import/export

### Why tRPC over REST

1. **No manual type definitions**: REST requires maintaining OpenAPI specs or duplicating types
2. **Less boilerplate**: No need for separate DTOs, validators, and response types
3. **Better error messages**: TypeScript errors for invalid API calls at compile time
4. **Auto-completion**: IDE knows all available procedures and their signatures
5. **Refactoring-friendly**: Renaming procedures updates all call sites

### Alternatives Considered

#### REST with Express + OpenAPI

**Pros:**

- Industry standard, widely understood
- Language-agnostic (can be consumed by non-TypeScript clients)
- Mature tooling (Postman, Swagger UI)
- Standard HTTP semantics (GET, POST, PUT, DELETE)

**Cons:**

- Manual type synchronization between frontend and backend
- Requires OpenAPI spec generation or manual maintenance
- More boilerplate (controllers, DTOs, response mapping)
- No compile-time safety for API calls
- Documentation can drift from implementation

**Decision:** Type safety and DX gains outweigh REST's standardization benefits for a TypeScript monorepo.

#### GraphQL with Apollo

**Pros:**

- Strong typing with schema-first approach
- Flexible queries (avoid over-fetching)
- Real-time with subscriptions
- Mature ecosystem

**Cons:**

- Significant complexity overhead (schema definition, resolvers, code generation)
- N+1 query problem requires careful dataloader setup
- Overkill for straightforward CRUD operations
- Larger bundle size
- Steep learning curve

**Decision:** GraphQL's flexibility isn't needed for our use case. tRPC provides similar type safety with less complexity.

#### gRPC

**Pros:**

- High performance binary protocol
- Strong typing with Protocol Buffers
- Excellent for microservices

**Cons:**

- Not browser-native (requires grpc-web proxy)
- More complex setup than HTTP/JSON
- Steeper learning curve
- Less suited for web applications

**Decision:** gRPC is better for backend services communication, not web clients.

## Consequences

### Positive

- **Type safety everywhere**: Database → tRPC → Frontend with full autocomplete
- **Rapid development**: No API documentation to maintain, types are self-documenting
- **Fewer bugs**: Invalid API calls caught at compile time
- **Easy refactoring**: TypeScript finds all usages when renaming procedures
- **Request optimization**: Automatic batching reduces network overhead
- **Real-time ready**: WebSocket subscriptions for order updates and price feeds

### Negative

- **TypeScript only**: Cannot easily consume API from non-TypeScript clients (mobile apps, Python scripts)
- **Monorepo requirement**: Client and server must share TypeScript types
- **Less standardized**: Smaller ecosystem than REST or GraphQL
- **Learning curve**: Team must learn tRPC patterns and concepts
- **Debugging**: Network tab shows batched requests, not individual calls

### Neutral

- **Deployment**: Requires Node.js runtime (can't use serverless edge functions for all operations)
- **Caching**: Different caching strategy than RESTful resources

## Implementation Notes

### Project Setup

```bash
npm install @trpc/server @trpc/client @trpc/react-query
npm install zod
```

### Backend Structure

```typescript
// server/trpc/trpc.ts - tRPC instance and middleware
import { initTRPC } from '@trpc/server';
import { ZodError } from 'zod';

const t = initTRPC.context<Context>().create({
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

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);

// server/trpc/routers/orders.ts - Order procedures
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const ordersRouter = router({
  place: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        symbol: z.string().min(1).max(10),
        side: z.enum(['BUY', 'SELL']),
        quantity: z.number().int().positive(),
        orderType: z.enum(['MARKET', 'LIMIT']),
        limitPrice: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return orderService.placeOrder(input, ctx.userId);
    }),

  list: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        status: z.enum(['PENDING', 'FILLED', 'CANCELLED']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return orderService.listOrders(input.accountId, input.status, ctx.userId);
    }),

  onUpdates: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .subscription(async function* ({ input, ctx }) {
      // Emit order updates in real-time
      for await (const update of orderEventEmitter) {
        if (update.accountId === input.accountId) {
          yield update;
        }
      }
    }),
});
```

### Frontend Usage

```typescript
// composables/useOrders.ts
import { useTRPCClient } from './useTRPC';

export function useOrders(accountId: string) {
  const trpc = useTRPCClient();

  const { data: orders, refetch } = trpc.orders.list.useQuery({
    accountId,
  });

  const placeMutation = trpc.orders.place.useMutation({
    onSuccess: () => refetch(),
  });

  async function placeOrder(params: OrderParams) {
    return placeMutation.mutateAsync({
      accountId,
      ...params,
    });
  }

  return {
    orders,
    placeOrder,
    isPlacing: placeMutation.isLoading,
  };
}
```

### Router Composition

```typescript
// server/trpc/root.ts
import { router } from './trpc';
import { usersRouter } from './routers/users';
import { accountsRouter } from './routers/accounts';
import { ordersRouter } from './routers/orders';
import { positionsRouter } from './routers/positions';
import { marketDataRouter } from './routers/marketData';

export const appRouter = router({
  users: usersRouter,
  accounts: accountsRouter,
  orders: ordersRouter,
  positions: positionsRouter,
  marketData: marketDataRouter,
});

export type AppRouter = typeof appRouter;
```

### Middleware Patterns

```typescript
// Auth middleware
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

// Audit logging middleware
const auditMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();

  await auditLog.create({
    actor: ctx.userId,
    action: `${type.toUpperCase()}_${path}`,
    duration: Date.now() - start,
    requestId: ctx.requestId,
  });

  return result;
});
```

## Integration with Nuxt

tRPC integrates seamlessly with Nuxt 3 via server routes:

```typescript
// server/api/trpc/[trpc].ts - Nuxt server handler
import { createNuxtApiHandler } from 'trpc-nuxt';
import { appRouter } from '~/server/trpc/root';
import { createContext } from '~/server/trpc/context';

export default createNuxtApiHandler({
  router: appRouter,
  createContext,
});
```

## Related Decisions

- [ADR 0001: Frontend Framework](./0001-frontend-framework.md) - Nuxt 3 with TypeScript
- [ADR 0003: Database ORM](./0003-database-orm.md) - Prisma for type-safe database access
- [ADR 0004: Auth Provider](./0004-auth-provider.md) - Authentication integration

## References

- [tRPC Documentation](https://trpc.io/docs)
- [tRPC with Nuxt](https://trpc.io/docs/client/nuxt)
- [Zod Validation](https://zod.dev/)
- [tRPC vs REST vs GraphQL](https://trpc.io/docs/concepts)

## Review Date

This decision should be reviewed in **6 months (June 2026)** or when:

- Need to support non-TypeScript clients becomes critical
- tRPC limitations impact feature development
- Alternative solutions (e.g., TypeScript-first GraphQL) mature significantly
