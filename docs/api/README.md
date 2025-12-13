# API Documentation

## Overview

API specifications and integration guides for Trade.io.

## Documents

- [Design Principles](./design-principles.md) - API design patterns and conventions
- [Endpoints](./endpoints/) - Individual endpoint specifications
- [Error Handling](./error-handling.md) - Error response formats
- [Authentication](./authentication.md) - How to authenticate API requests
- [Versioning](./versioning.md) - API versioning strategy

## API Style

Trade.io uses **tRPC** (type-safe RPC) for the API layer. This provides:

- End-to-end type safety
- Automatic TypeScript types for clients
- No manual API documentation generation needed
- Runtime validation with Zod

## Base URL

- **Development**: `http://localhost:3000/api/trpc`
- **Staging**: `https://staging.trade.io/api/trpc`
- **Production**: `https://api.trade.io/api/trpc`

## Authentication

All API requests (except public endpoints) require authentication:

```typescript
// Using tRPC client
import { createTRPCProxyClient } from '@trpc/client';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
      headers() {
        return {
          authorization: `Bearer ${token}`,
        };
      },
    }),
  ],
});

// Make authenticated request
const user = await client.user.getProfile.query();
```

## Error Responses

All errors follow a consistent format:

```typescript
{
  error: {
    code: 'UNAUTHORIZED',
    message: 'Invalid credentials',
    path: 'auth.login',
    details?: any
  }
}
```

**Error Codes:**

- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: User lacks permission
- `NOT_FOUND`: Resource not found
- `BAD_REQUEST`: Invalid input
- `CONFLICT`: Resource conflict (e.g., duplicate)
- `INTERNAL_SERVER_ERROR`: Unexpected error

## Rate Limiting

- **Authentication endpoints**: 5 requests per minute per IP
- **Order placement**: 100 requests per minute per user
- **General API**: 1000 requests per minute per user

Rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## Idempotency

Write operations support idempotency via the `Idempotency-Key` header:

```typescript
await client.orders.place.mutate(
  {
    accountId: '...',
    symbol: 'AAPL',
    side: 'BUY',
    quantity: 10,
    orderType: 'MARKET',
  },
  {
    context: {
      headers: {
        'Idempotency-Key': 'unique-key-123',
      },
    },
  }
);
```

Retrying with the same key returns the original response.

## Pagination

List endpoints support cursor-based pagination:

```typescript
const result = await client.orders.list.query({
  accountId: '...',
  limit: 50,
  cursor: 'nextCursor',
});

// Result:
{
  items: [...],
  nextCursor: 'abc123',
  hasMore: true
}
```

## Filtering and Sorting

```typescript
await client.orders.list.query({
  accountId: '...',
  status: 'PENDING',
  symbol: 'AAPL',
  orderBy: 'createdAt',
  order: 'desc',
});
```

## API Endpoints

### Authentication

- `auth.login` - Login with email/password
- `auth.signup` - Create new account
- `auth.logout` - Logout current session
- `auth.refresh` - Refresh access token

### Users

- `user.getProfile` - Get current user profile
- `user.updateProfile` - Update profile
- `user.changePassword` - Change password

### Accounts

- `accounts.list` - List user's accounts
- `accounts.get` - Get account details
- `accounts.create` - Create new account
- `accounts.update` - Update account
- `accounts.addMember` - Add account member
- `accounts.removeMember` - Remove account member

### Orders

- `orders.place` - Place new order
- `orders.list` - List orders
- `orders.get` - Get order details
- `orders.modify` - Modify pending order
- `orders.cancel` - Cancel pending order
- `orders.history` - Get order history

### Positions

- `positions.list` - List current positions
- `positions.get` - Get position details
- `positions.history` - Position history

### Portfolio

- `portfolio.summary` - Get portfolio summary
- `portfolio.performance` - Get performance metrics
- `portfolio.transactions` - Transaction history

### Market Data

- `instruments.search` - Search instruments
- `instruments.get` - Get instrument details
- `quotes.latest` - Get latest quote
- `quotes.history` - Historical quotes
- `bars.get` - Get OHLCV bars

### Admin

- `admin.users.list` - List all users
- `admin.users.suspend` - Suspend user
- `admin.riskLimits.set` - Set risk limits
- `admin.symbols.restrict` - Restrict/halt symbol

## Webhooks (Future)

Webhooks for real-time notifications (planned):

- Order fills
- Account alerts
- Price alerts

## SDK (Future)

Official SDKs planned for:

- TypeScript/JavaScript
- Python
- Go

## Support

- **API Documentation**: This directory
- **Issues**: GitHub Issues
- **Support**: support@trade.io

---

**Note**: Detailed endpoint specs will be added as endpoints are implemented in Phase 2-5 issues.
