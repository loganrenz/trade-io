# Authorization Middleware

## Overview

The authorization middleware provides a robust, type-safe way to protect tRPC endpoints and ensure users can only access resources they own.

## Architecture

The authorization system consists of two main components:

1. **Authorization Service** (`server/lib/authz.ts`) - Core authorization logic
2. **Authorization Middleware** (`server/trpc/middleware/authz.ts`) - tRPC middleware integration

## Authorization Service

The authorization service provides functions to check resource access:

### Core Functions

#### `checkAccountAccess(userId, accountId)`
Verifies a user has access to an account. Throws `ForbiddenError` or `NotFoundError`.

```typescript
await checkAccountAccess(userId, accountId);
// Throws if user doesn't own the account
```

#### `isAccountOwner(userId, accountId)`
Returns boolean indicating if user owns the account (non-throwing version).

```typescript
if (await isAccountOwner(userId, accountId)) {
  // User owns account
}
```

#### `getUserAccountIds(userId)`
Returns array of all account IDs a user has access to.

```typescript
const accountIds = await getUserAccountIds(userId);
// ['account-1', 'account-2', ...]
```

#### `checkOrderAccess(userId, orderId)`
Verifies user owns the account associated with an order.

#### `checkPositionAccess(userId, positionId)`
Verifies user owns the account associated with a position.

### Query Filter Helpers

#### `accountOwnerFilter(userId)`
Returns a Prisma where clause for filtering account-related resources:

```typescript
const orders = await db.order.findMany({
  where: accountOwnerFilter(userId),
});
// Only returns orders from accounts the user owns
```

#### `userAccountsFilter(userId)`
Returns a Prisma where clause for filtering user's accounts:

```typescript
const accounts = await db.account.findMany({
  where: userAccountsFilter(userId),
});
```

## tRPC Middleware

Pre-configured procedures that automatically verify access:

### Available Procedures

#### `accountProtectedProcedure`
Requires authentication and verifies `accountId` in input:

```typescript
export const myRouter = router({
  getAccount: accountProtectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ input }) => {
      // User's access to input.accountId already verified
      return db.account.findUnique({ where: { id: input.accountId } });
    }),
});
```

#### `orderProtectedProcedure`
Requires authentication and verifies `orderId` in input:

```typescript
export const myRouter = router({
  getOrder: orderProtectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(async ({ input }) => {
      // User's access to order already verified
      return db.order.findUnique({ where: { id: input.orderId } });
    }),
});
```

#### `positionProtectedProcedure`
Requires authentication and verifies `positionId` in input:

```typescript
export const myRouter = router({
  getPosition: positionProtectedProcedure
    .input(z.object({ positionId: z.string().uuid() }))
    .query(async ({ input }) => {
      // User's access to position already verified
      return db.position.findUnique({ where: { id: input.positionId } });
    }),
});
```

### Custom Authorization Middleware

For resources with custom authorization logic:

```typescript
import { createAuthzMiddleware } from '~/server/trpc/middleware/authz';

const requireCustomAccess = createAuthzMiddleware({
  getResourceId: (input) => input.customId,
  checkAccess: async (userId, resourceId) => {
    const resource = await db.customResource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || resource.ownerId !== userId) {
      throw new ForbiddenError('Access denied');
    }
  },
  resourceIdFieldName: 'customId', // Optional: for better error messages
});

export const customProtectedProcedure = protectedProcedure.use(requireCustomAccess);
```

## Error Handling

The authorization system throws two types of errors:

- **`ForbiddenError`** (403) - User doesn't have permission to access the resource
- **`NotFoundError`** (404) - Resource doesn't exist

These are automatically converted to appropriate tRPC errors with correct HTTP status codes.

## Security Considerations

1. **Always check authorization** - Never rely solely on authentication
2. **Filter at database level** - Use `accountOwnerFilter()` to ensure queries only return user's data
3. **Fail closed** - Default to denying access unless explicitly granted
4. **Audit logging** - All access checks should be logged for compliance
5. **Soft deletes** - Authorization checks exclude soft-deleted resources

## Testing

The authorization system includes comprehensive tests:

- **Unit tests** (`tests/unit/authz.test.ts`) - 22 test cases covering all authorization functions
- **Integration tests** (`tests/integration/authz-middleware.test.ts`) - Tests tRPC middleware integration

Run tests with:
```bash
npm run test:unit -- tests/unit/authz.test.ts
npm run test:integration -- tests/integration/authz-middleware.test.ts
```

## Usage Examples

### Protecting a Route

```typescript
import { router, accountProtectedProcedure } from '~/server/trpc/trpc';
import { z } from 'zod';

export const accountRouter = router({
  // Automatically verifies user owns the account
  get: accountProtectedProcedure
    .input(z.object({ accountId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.account.findUnique({
        where: { id: input.accountId },
        include: { positions: true, orders: true },
      });
    }),

  // List all accounts user has access to
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.account.findMany({
      where: userAccountsFilter(ctx.userId),
    });
  }),
});
```

### Manual Authorization Check

```typescript
import { protectedProcedure } from '~/server/trpc/trpc';
import { checkAccountAccess } from '~/server/lib/authz';

export const customProcedure = protectedProcedure
  .input(z.object({ accountId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    // Manual authorization check
    await checkAccountAccess(ctx.userId, input.accountId);

    // Proceed with operation
    return performOperation(input.accountId);
  });
```

## Future Enhancements

Potential improvements for future versions:

1. **Role-based access control (RBAC)** - Support for different user roles (admin, member, viewer)
2. **Account sharing** - Multiple users can access the same account with different permissions
3. **Resource-level permissions** - Fine-grained permissions per resource type
4. **Permission caching** - Cache authorization decisions to reduce database queries
5. **Audit trail** - Log all authorization checks for compliance and debugging
