# ADR 0003: Database ORM Selection

## Status

**Accepted** - 2025-12-12

## Context

We need to choose an ORM (Object-Relational Mapping) tool for database access. Requirements include:

- **Type safety**: End-to-end types from database schema to application code
- **Migration management**: Robust schema migrations with rollback support
- **Query builder**: Intuitive API for complex queries
- **Performance**: Efficient query execution and connection pooling
- **Relations**: Easy handling of joins and nested data
- **Raw SQL escape hatch**: Ability to write optimized SQL when needed
- **PostgreSQL features**: Support for JSONB, arrays, full-text search, transactions
- **Developer experience**: Clear errors, autocomplete, good documentation

The platform will have complex relationships (users, accounts, orders, positions, audit logs) requiring robust data modeling.

## Decision

**We will use Prisma as our ORM.**

## Rationale

### Why Prisma

1. **Schema-first design**: Single source of truth in `schema.prisma` file
2. **Type-safe client**: Generated TypeScript types match database schema exactly
3. **Excellent DX**: Autocomplete for queries, clear error messages
4. **Migration system**: Declarative migrations with automatic generation
5. **Relation handling**: Intuitive API for joins and nested queries
6. **Connection pooling**: Built-in connection management
7. **Prisma Studio**: GUI for viewing and editing data
8. **Transaction support**: Nested transactions and interactive transactions
9. **Middleware**: Hooks for logging, soft deletes, audit trails
10. **Active development**: Well-funded, rapidly improving

### Why Prisma over Drizzle

1. **Maturity**: Prisma is production-proven with years of development
2. **Tooling**: Prisma Studio, better IDE support
3. **Migrations**: More robust migration system with better conflict resolution
4. **Documentation**: Comprehensive guides and examples
5. **Community**: Larger ecosystem of plugins and examples

### Alternatives Considered

#### Drizzle ORM

**Pros:**

- Lighter weight (smaller bundle size)
- SQL-like syntax (closer to raw SQL)
- Better performance for some query patterns
- Flexible schema definition (can use TypeScript)

**Cons:**

- Newer, less battle-tested
- Smaller community and ecosystem
- Migration tooling less mature
- No built-in data browser like Prisma Studio
- Documentation gaps for advanced use cases

**Decision:** Prisma's maturity and developer experience outweigh Drizzle's performance advantages.

#### TypeORM

**Pros:**

- Mature and stable
- Decorator-based models (familiar to Java/C# developers)
- Active Record and Data Mapper patterns

**Cons:**

- Less type-safe than Prisma
- Schema definition in TypeScript (not separate schema file)
- Migration generation less reliable
- More boilerplate code
- Slower development than Prisma

**Decision:** Prisma's type safety and DX are significantly better.

#### Kysely

**Pros:**

- Type-safe SQL builder
- Very close to raw SQL
- Excellent TypeScript inference
- Lightweight

**Cons:**

- Lower-level (more manual query building)
- No schema management or migrations
- No relation helpers
- More boilerplate for common operations

**Decision:** Too low-level; we want higher abstraction with relations.

#### Sequelize

**Pros:**

- Very mature and stable
- Large community
- Extensive features

**Cons:**

- Poor TypeScript support
- Outdated patterns
- Verbose API
- Less active development

**Decision:** Not TypeScript-first; Prisma is clearly better for modern TS projects.

## Consequences

### Positive

- **End-to-end type safety**: Schema → Prisma Client → tRPC → Frontend
- **Rapid development**: Less boilerplate than raw SQL or query builders
- **Safety**: Type errors for invalid queries, migrations prevent data loss
- **Introspection**: Can reverse-engineer existing databases
- **Great DX**: Autocomplete, Prisma Studio, clear errors
- **Relation queries**: Simple API for complex joins and nested data
- **Audit trail ready**: Middleware for tracking changes

### Negative

- **Abstraction penalty**: Some complex queries harder than raw SQL
- **Bundle size**: Prisma client adds ~2MB to deployment
- **Lock-in**: Migrating away from Prisma requires rewriting data access layer
- **Some performance overhead**: Not as fast as hand-optimized SQL

### Neutral

- **Schema management**: Need to maintain `schema.prisma` file
- **Code generation**: Must run `prisma generate` after schema changes
- **Migration workflow**: Need discipline to create migrations properly

## Implementation Notes

### Installation

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### Project Setup

```bash
# Initialize Prisma
npx prisma init

# This creates:
# - prisma/schema.prisma
# - .env (with DATABASE_URL)
```

### Schema Structure

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(uuid()) @db.Uuid
  email         String    @unique
  emailVerified Boolean   @default(false)
  passwordHash  String?
  provider      String?   // supabase, clerk, etc.
  providerUserId String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?

  accounts      Account[]
  auditLogs     AuditLog[]

  @@map("users")
}

model Account {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  type      String   // INDIVIDUAL, JOINT, MARGIN
  status    String   @default("ACTIVE") // ACTIVE, SUSPENDED, CLOSED
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ownerId   String   @db.Uuid
  owner     User     @relation(fields: [ownerId], references: [id])

  orders    Order[]
  positions Position[]
  ledgerEntries LedgerEntry[]

  @@map("accounts")
  @@index([ownerId])
  @@index([status])
}

model Order {
  id              String   @id @default(uuid()) @db.Uuid
  accountId       String   @db.Uuid
  symbol          String
  side            String   // BUY, SELL
  quantity        Int
  orderType       String   // MARKET, LIMIT
  limitPrice      Decimal? @db.Decimal(18, 4)
  status          String   @default("PENDING") // PENDING, FILLED, CANCELLED, REJECTED
  filledQuantity  Int      @default(0)
  averagePrice    Decimal? @db.Decimal(18, 4)
  timeInForce     String   @default("DAY")
  idempotencyKey  String   @unique
  version         Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  account         Account  @relation(fields: [accountId], references: [id])
  executions      Execution[]

  @@map("orders")
  @@index([accountId, status])
  @@index([symbol])
  @@index([createdAt])
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  actor      String?  @db.Uuid
  action     String
  resource   String
  resourceId String?
  metadata   Json?
  requestId  String?
  ipAddress  String?
  timestamp  DateTime @default(now())

  user       User?    @relation(fields: [actor], references: [id])

  @@map("audit_logs")
  @@index([actor])
  @@index([action])
  @@index([resource, resourceId])
  @@index([timestamp])
}
```

### Client Usage

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// services/order-service.ts
import { db } from '../lib/db';

export class OrderService {
  async placeOrder(params: OrderParams, userId: string) {
    // Check authorization
    const account = await db.account.findFirst({
      where: { id: params.accountId, ownerId: userId },
    });
    if (!account) throw new ForbiddenError();

    // Create order with transaction
    return db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          accountId: params.accountId,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          orderType: params.orderType,
          limitPrice: params.limitPrice,
          idempotencyKey: params.idempotencyKey,
        },
      });

      await tx.auditLog.create({
        data: {
          actor: userId,
          action: 'ORDER_PLACED',
          resource: 'order',
          resourceId: order.id,
          metadata: params,
        },
      });

      return order;
    });
  }

  async listOrders(accountId: string, userId: string) {
    // Check authorization
    const account = await db.account.findFirst({
      where: { id: accountId, ownerId: userId },
    });
    if (!account) throw new ForbiddenError();

    return db.order.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      include: {
        executions: true,
      },
    });
  }
}
```

### Migration Workflow

```bash
# Create migration after schema change
npx prisma migrate dev --name add_orders_table

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# View database in GUI
npx prisma studio
```

### Middleware Example

```typescript
// Soft delete middleware
db.$use(async (params, next) => {
  if (params.model === 'User') {
    if (params.action === 'delete') {
      // Convert delete to update (soft delete)
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }
    if (params.action === 'findMany' || params.action === 'findFirst') {
      // Exclude soft-deleted records
      params.args.where = { ...params.args.where, deletedAt: null };
    }
  }
  return next(params);
});
```

### Performance Patterns

```typescript
// Use select to fetch only needed fields
const users = await db.user.findMany({
  select: {
    id: true,
    email: true,
    createdAt: true,
  },
});

// Use cursor-based pagination for large result sets
const orders = await db.order.findMany({
  take: 100,
  skip: 1,
  cursor: { id: lastOrderId },
  orderBy: { createdAt: 'desc' },
});

// Use raw queries for complex operations
const result = await db.$queryRaw`
  SELECT symbol, SUM(quantity) as total_quantity
  FROM orders
  WHERE account_id = ${accountId} AND status = 'FILLED'
  GROUP BY symbol
`;
```

## Integration with tRPC

Prisma integrates perfectly with tRPC for end-to-end type safety:

```typescript
// server/trpc/routers/orders.ts
import { router, protectedProcedure } from '../trpc';
import { db } from '../../lib/db';

export const ordersRouter = router({
  list: protectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(({ input, ctx }) => {
      return db.order.findMany({
        where: {
          accountId: input.accountId,
          account: { ownerId: ctx.userId }, // Authorization check
        },
      });
    }),
});
```

Types flow automatically: Prisma → tRPC router → Frontend client.

## Related Decisions

- [ADR 0002: Backend API Pattern](./0002-backend-api-pattern.md) - tRPC for type-safe API
- [ADR 0005: Database Hosting](./0005-database-hosting.md) - PostgreSQL hosting choice

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Prisma with tRPC](https://trpc.io/docs/server/prisma)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)

## Review Date

This decision should be reviewed in **12 months (December 2026)** or when:

- Prisma performance becomes a bottleneck
- Need for lower-level database access increases significantly
- Alternative ORMs (e.g., Drizzle) mature substantially
