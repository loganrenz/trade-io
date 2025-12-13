# GitHub Copilot Instructions for Trade.io

## Project Overview

Trade.io is a production-grade paper trading platform (E\*TRADE-like) built with security, testability, and robustness as core principles. This is NOT a toy project—every line of code should meet production standards.

## Core Principles

### 1. Security First

- **Never** suggest code that could introduce security vulnerabilities
- Always validate user inputs with Zod schemas
- Use parameterized queries (ORM handles this)
- Check authorization on every endpoint
- Log all state changes to audit log
- Never include secrets in code suggestions

### 2. TypeScript Strict Mode

- Use strict TypeScript—no `any` types unless absolutely necessary
- Prefer explicit types over inference for public APIs
- Use discriminated unions for state machines
- Leverage Zod for runtime validation that matches TypeScript types

### 3. Test Coverage

- Suggest unit tests alongside business logic
- Suggest integration tests for API endpoints
- Use factories for test data, not hardcoded fixtures
- Tests should be isolated and repeatable

### 4. Code Patterns

#### API Endpoints

```typescript
// Good: Validated, authorized, audited
export async function placeOrder(req: Request, res: Response) {
  // 1. Validate input
  const params = orderPlacementSchema.parse(req.body);

  // 2. Authenticate
  const userId = await authenticateRequest(req);

  // 3. Authorize
  await checkAccountAccess(userId, params.accountId);

  // 4. Execute business logic
  const order = await orderService.placeOrder(params, req.idempotencyKey);

  // 5. Audit log
  await auditLog.log({
    actor: userId,
    action: 'ORDER_PLACED',
    resourceId: order.id,
    metadata: params,
  });

  // 6. Return response
  return res.json(order);
}
```

#### Database Queries

```typescript
// Good: Use ORM/query builder, never string concat
const orders = await db.order.findMany({
  where: {
    accountId: params.accountId,
    status: { in: ['PENDING', 'PARTIAL'] },
  },
  orderBy: { createdAt: 'desc' },
});

// Bad: SQL injection risk
const orders = await db.raw(`
  SELECT * FROM orders WHERE account_id = '${accountId}'
`);
```

#### Error Handling

```typescript
// Good: Typed errors, safe messages
try {
  await service.execute();
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  // Never leak internal details
  logger.error('Service error', { error, userId });
  return res.status(500).json({ error: 'Internal server error' });
}
```

### 5. Naming Conventions

- **Files**: kebab-case (`order-service.ts`)
- **Variables/Functions**: camelCase (`placeOrder`)
- **Classes/Types**: PascalCase (`OrderService`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_ORDER_SIZE`)
- **Database columns**: snake_case (`created_at`)
- **API fields**: camelCase (`createdAt`)

### 6. Documentation

Suggest JSDoc for:

- Public API functions
- Complex business logic
- Non-obvious behavior

```typescript
/**
 * Places a new order with idempotency support.
 *
 * @param params - Order parameters (validated)
 * @param idempotencyKey - Client-provided idempotency key
 * @returns Created order or existing order if duplicate key
 * @throws {InsufficientFundsError} If account lacks buying power
 * @throws {InvalidSymbolError} If symbol is not tradeable
 */
async function placeOrder(params: OrderParams, idempotencyKey: string): Promise<Order> {
  // ...
}
```

### 7. Forbidden Patterns

Never suggest:

- Using `any` without a VERY good reason
- Disabling ESLint rules without explanation
- Committing secrets or credentials
- Direct SQL string concatenation
- Missing authorization checks
- Unvalidated user inputs
- Logging sensitive data (passwords, tokens, SSNs)
- Mutating function parameters
- Catching errors without logging
- Using `console.log` (use proper logger)

### 8. Preferred Libraries

When suggesting packages, prefer:

- **Validation**: Zod
- **Date/Time**: date-fns
- **HTTP Client**: fetch API or ky
- **Testing**: Vitest (unit), Playwright (E2E)
- **Logging**: pino or winston
- **UUID**: crypto.randomUUID()

Avoid:

- moment.js (use date-fns)
- axios (use fetch or ky)
- lodash (use native ES6+ when possible)
- class-validator (use Zod)

## Domain-Specific Guidance

### Order Lifecycle

Orders follow this state machine:

```
PENDING → ACCEPTED → (PARTIAL →)* → FILLED
        ↓         ↓              ↓
      REJECTED  CANCELLED    CANCELLED

PENDING → EXPIRED
```

When suggesting order-related code, respect these transitions.

### Financial Calculations

Always use precise decimal math:

```typescript
// Good: Use library for financial math
import { Decimal } from 'decimal.js';
const totalCost = new Decimal(price).times(quantity);

// Bad: Floating point errors
const totalCost = price * quantity; // Can have rounding errors!
```

### Audit Logging

Every state change should log:

```typescript
await auditLog.create({
  actor: userId,           // Who did it
  action: 'ORDER_PLACED',  // What happened
  resource: 'order',       // What type of thing
  resourceId: order.id,    // Which specific thing
  metadata: { ... },       // Additional context
  requestId: req.id,       // For correlation
  timestamp: new Date(),   // When
});
```

### Idempotency

Write operations should accept idempotency keys:

```typescript
const existing = await db.order.findUnique({
  where: { idempotencyKey },
});
if (existing) return existing;

// Proceed with creation...
```

### Authorization

Every query should filter by user access:

```typescript
// Good: Only return accounts user has access to
const accounts = await db.account.findMany({
  where: {
    members: {
      some: { userId },
    },
  },
});

// Bad: Return all accounts (security hole!)
const accounts = await db.account.findMany();
```

## Testing Guidance

### Unit Test Structure

```typescript
describe('OrderService', () => {
  describe('placeOrder', () => {
    it('should create a pending order for valid market order', async () => {
      const params = createTestOrderParams({ orderType: 'MARKET' });
      const order = await orderService.placeOrder(params, 'idempotency-1');

      expect(order.status).toBe('PENDING');
      expect(order.orderType).toBe('MARKET');
    });

    it('should reject order if insufficient funds', async () => {
      const params = createTestOrderParams({ quantity: 1000000 });

      await expect(orderService.placeOrder(params, 'idempotency-2')).rejects.toThrow(
        InsufficientFundsError
      );
    });
  });
});
```

### Integration Test Structure

```typescript
describe('POST /api/orders', () => {
  it('should place order and return 201', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: testAccount.id,
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('PENDING');
  });
});
```

## File Organization

Suggest files in this structure:

```
src/
  lib/           # Shared utilities
  services/      # Business logic (domain services)
  api/           # API routes/handlers
  db/            # Database client, schemas
  types/         # Shared TypeScript types
  middleware/    # Express/tRPC middleware
tests/
  unit/          # Unit tests (mirrors src/)
  integration/   # API integration tests
  e2e/           # End-to-end tests
  factories/     # Test data factories
docs/
  architecture/  # Architecture docs
  api/           # API documentation
  security/      # Security docs
```

## Comments and Documentation

Suggest comments for:

- Complex algorithms or business rules
- Non-obvious workarounds
- Security-sensitive code
- Performance optimizations

Don't suggest comments for:

- Obvious code
- Repeating what the code says
- Redundant JSDoc

```typescript
// Good: Explains WHY
// Using pessimistic locking here to prevent race conditions
// during concurrent order placements on the same account
await db.$executeRaw`SELECT * FROM accounts WHERE id = ${accountId} FOR UPDATE`;

// Bad: Explains WHAT (obvious from code)
// Increment the counter
counter++;
```

## Common Pitfalls to Avoid

1. **Race Conditions**: Suggest optimistic/pessimistic locking for concurrent writes
2. **SQL Injection**: Always use parameterized queries
3. **Missing Authorization**: Check user access on every endpoint
4. **Unvalidated Input**: Validate with Zod before processing
5. **Logging Sensitive Data**: Redact passwords, tokens, SSNs
6. **Hardcoded Values**: Use environment variables for config
7. **Missing Audit Logs**: Log all state changes
8. **No Idempotency**: Support idempotency keys on writes
9. **Poor Error Messages**: Don't leak internal implementation details
10. **Missing Tests**: Suggest test cases alongside code

## When Suggesting Database Schema

Always include:

- Primary keys (UUID preferred)
- Foreign key constraints
- Indexes for common queries
- NOT NULL constraints where appropriate
- Unique constraints
- Timestamps (created_at, updated_at)
- Soft delete column if applicable (deleted_at)

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  symbol VARCHAR(10) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  INDEX idx_orders_account_id (account_id),
  INDEX idx_orders_status (status) WHERE deleted_at IS NULL
);
```

## Performance Considerations

Suggest optimizations for:

- N+1 query problems (use eager loading)
- Missing indexes on foreign keys
- Expensive full table scans
- Large JSON objects in responses (pagination)
- Heavy computational work (consider background jobs)

But always prioritize **correctness and security** over performance.

## Final Reminders

- This is a **production-grade** project, not a prototype
- Security is non-negotiable
- Every line of code should be testable
- Documentation is part of the code
- When in doubt, be explicit and verbose rather than clever and terse

Thank you for helping build a robust, secure trading platform! 🚀
