# Audit Logging Service

## Overview

The audit logging service provides a comprehensive, production-grade audit trail for all state changes and security-relevant events in the Trade.io application. Every significant action is logged with full context for compliance, debugging, and security monitoring.

## Core Principles

1. **Immutability**: Audit logs cannot be modified or deleted (in production)
2. **Completeness**: All state changes are logged
3. **Context**: Each log includes actor, action, resource, and metadata
4. **Resilience**: Logging failures do not break user operations
5. **Performance**: Async logging with minimal impact on request latency

## Architecture

### Database Schema

The `audit_logs` table stores all audit entries:

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  actor UUID,                    -- User who performed the action
  action VARCHAR(100),            -- What happened (e.g., 'ORDER_PLACED')
  resource VARCHAR(50),           -- Type of resource (e.g., 'order')
  resource_id UUID,               -- Specific resource ID
  metadata JSONB,                 -- Additional context
  request_id UUID,                -- For request correlation
  ip_address VARCHAR(45),         -- Client IP
  user_agent TEXT,                -- Client user agent
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
```

### Service Layer

The `AuditService` class provides the main interface:

```typescript
import { auditService, AuditAction } from '~/server/lib/audit';

// Single log entry
await auditService.log({
  actor: userId,
  action: AuditAction.ORDER_PLACED,
  resource: 'order',
  resourceId: order.id,
  metadata: { symbol: 'AAPL', quantity: 10 },
  requestId: ctx.requestId,
  ipAddress: ctx.ipAddress,
  userAgent: ctx.userAgent,
});

// Batch logging (transactional)
await auditService.logBatch([
  { action: AuditAction.ORDER_PLACED, resource: 'order', ... },
  { action: AuditAction.POSITION_OPENED, resource: 'position', ... },
]);

// Query audit logs
const result = await auditService.query({
  actor: userId,
  action: AuditAction.ORDER_PLACED,
  startDate: new Date('2025-01-01'),
  limit: 50,
});

// Get resource history
const history = await auditService.getResourceHistory('order', orderId);
```

## Standard Audit Actions

The service defines standard actions for consistency:

### User Actions

- `USER_CREATED` - New user account created
- `USER_UPDATED` - User profile updated
- `USER_DELETED` - User account deleted (soft delete)
- `USER_LOGIN` - User logged in
- `USER_LOGOUT` - User logged out

### Account Actions

- `ACCOUNT_CREATED` - Trading account created
- `ACCOUNT_UPDATED` - Account settings updated
- `ACCOUNT_DELETED` - Account closed
- `ACCOUNT_SUSPENDED` - Account suspended by admin
- `ACCOUNT_ACTIVATED` - Account reactivated

### Order Actions

- `ORDER_PLACED` - New order submitted
- `ORDER_MODIFIED` - Order modified
- `ORDER_CANCELLED` - Order cancelled by user
- `ORDER_FILLED` - Order fully executed
- `ORDER_REJECTED` - Order rejected by system
- `ORDER_EXPIRED` - Order expired (e.g., DAY order at EOD)

### Position Actions

- `POSITION_OPENED` - New position established
- `POSITION_CLOSED` - Position fully closed
- `POSITION_UPDATED` - Position quantity/cost updated

### Ledger Actions

- `DEPOSIT` - Cash deposited
- `WITHDRAWAL` - Cash withdrawn
- `TRADE_SETTLED` - Trade settled in ledger
- `FEE_CHARGED` - Commission or fee charged
- `ADJUSTMENT` - Manual ledger adjustment

### Security Actions

- `UNAUTHORIZED_ACCESS` - Unauthorized access attempt
- `PERMISSION_DENIED` - Permission check failed
- `RATE_LIMIT_EXCEEDED` - Rate limit hit

## Usage Patterns

### 1. Basic Usage in Services

```typescript
import { auditService, AuditAction } from '~/server/lib/audit';

export async function placeOrder(params, context) {
  // Execute business logic
  const order = await db.order.create({ data: params });

  // Audit the action
  await auditService.log({
    actor: context.userId,
    action: AuditAction.ORDER_PLACED,
    resource: 'order',
    resourceId: order.id,
    metadata: {
      symbol: params.symbol,
      quantity: params.quantity,
      orderType: params.orderType,
    },
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return order;
}
```

### 2. Using Helper Functions

```typescript
import { auditFromContext, AuditAction } from '~/server/lib/audit';

export async function placeOrder(params, ctx) {
  const order = await db.order.create({ data: params });

  // Simplified with helper function
  await auditFromContext(AuditAction.ORDER_PLACED, 'order', order.id, ctx, {
    symbol: params.symbol,
    quantity: params.quantity,
  });

  return order;
}
```

### 3. Using tRPC Middleware

```typescript
import { auditMiddleware } from '~/server/trpc/middleware/audit';
import { AuditAction } from '~/server/lib/audit';

// Create an audited procedure
const auditedProcedure = publicProcedure.use(
  auditMiddleware({
    action: AuditAction.ORDER_PLACED,
    resource: 'order',
    getResourceId: (input: any) => input.orderId,
    includeInput: true, // Log the input params
  })
);

// Use in router
export const ordersRouter = router({
  place: auditedProcedure.input(orderPlacementSchema).mutation(async ({ input, ctx }) => {
    // Automatically audited by middleware
    return placeOrder(input, ctx);
  }),
});
```

### 4. Batch Logging for Transactions

```typescript
export async function settleTrade(execution) {
  // Execute database transaction
  const [ledgerEntry, position] = await db.$transaction([
    db.ledgerEntry.create({ data: ledgerData }),
    db.position.upsert({ where: { ... }, create: { ... }, update: { ... } }),
  ]);

  // Audit multiple related actions atomically
  await auditService.logBatch([
    {
      actor: userId,
      action: AuditAction.TRADE_SETTLED,
      resource: 'execution',
      resourceId: execution.id,
      requestId: ctx.requestId,
    },
    {
      actor: userId,
      action: AuditAction.POSITION_UPDATED,
      resource: 'position',
      resourceId: position.id,
      requestId: ctx.requestId,
    },
  ]);
}
```

## Querying Audit Logs

### Via API (Admin Only)

```typescript
// Query audit logs via tRPC
const result = await trpc.audit.query.query({
  actor: userId,
  action: 'ORDER_PLACED',
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-01-31T23:59:59Z',
  limit: 50,
  offset: 0,
});

// Get resource history
const history = await trpc.audit.getResourceHistory.query({
  resource: 'order',
  resourceId: orderId,
});
```

### Direct Service Access

```typescript
// Find all order actions by a user
const logs = await auditService.query({
  actor: userId,
  resource: 'order',
  limit: 100,
});

// Find all failed login attempts
const failedLogins = await auditService.query({
  action: 'UNAUTHORIZED_ACCESS',
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
});

// Get complete order lifecycle
const orderHistory = await auditService.getResourceHistory('order', orderId);
// Returns: ORDER_PLACED → ORDER_ACCEPTED → ORDER_FILLED
```

## Metadata Best Practices

Include relevant context in metadata, but be careful not to log sensitive data:

### ✅ Good Metadata

```typescript
metadata: {
  symbol: 'AAPL',
  quantity: 100,
  orderType: 'MARKET',
  accountId: account.id,
  accountType: 'INDIVIDUAL',
}
```

### ❌ Bad Metadata (Don't Log These)

```typescript
metadata: {
  password: '********',        // Never log credentials
  authToken: 'bearer ...',     // Never log tokens
  ssn: '123-45-6789',          // Never log PII
  creditCard: '4111...',       // Never log payment info
}
```

## Performance Considerations

1. **Async Logging**: Audit logging is fire-and-forget. Failures are logged but don't throw.

2. **Batch Operations**: Use `logBatch()` for multiple related actions to reduce DB round trips.

3. **Indexes**: All common query patterns have indexes (actor, action, resource, timestamp).

4. **Partitioning**: For high-volume systems, consider partitioning the `audit_logs` table by timestamp.

## Security

1. **Immutability**: In production, audit logs should be append-only (no updates/deletes).

2. **Access Control**: Only admins should be able to query audit logs.

3. **Retention**: Define a retention policy (e.g., keep logs for 7 years for compliance).

4. **Encryption**: Consider encrypting metadata if it contains business-sensitive data.

## Testing

The audit service has comprehensive test coverage:

- **Unit Tests**: `tests/unit/audit/audit-service.test.ts` (13 tests)
- **Integration Tests**: `tests/integration/audit-service.test.ts` (15+ tests)

Run tests:

```bash
# Unit tests (mocked database)
npm run test:unit -- audit

# Integration tests (real database)
npm run test:integration -- audit
```

## Troubleshooting

### Audit Logs Not Appearing

1. Check that the database is running
2. Verify `DATABASE_URL` is set correctly
3. Check application logs for errors (audit failures are logged)
4. Ensure migrations have been applied

### Performance Issues

1. Check database indexes are present
2. Consider reducing metadata size
3. Use batch logging for bulk operations
4. Monitor database query performance

### Missing Context (userId, requestId, etc.)

1. Ensure tRPC context is properly configured
2. Check that middleware is extracting request metadata
3. Verify authentication is working (userId may be null for unauthenticated requests)

## Future Enhancements

- [ ] Add audit log export functionality (CSV, JSON)
- [ ] Implement audit log retention policies
- [ ] Add real-time audit log streaming (WebSocket)
- [ ] Create audit log analytics dashboard
- [ ] Add anomaly detection (unusual patterns)
- [ ] Implement audit log signing for tamper detection

## References

- Prisma Schema: `prisma/schema.prisma`
- Service Implementation: `server/lib/audit.ts`
- tRPC Router: `server/trpc/routers/audit.ts`
- Middleware: `server/trpc/middleware/audit.ts`
- Unit Tests: `tests/unit/audit/audit-service.test.ts`
- Integration Tests: `tests/integration/audit-service.test.ts`
