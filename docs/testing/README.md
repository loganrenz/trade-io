# Testing Documentation

## Overview

Testing strategy, local development setup, and CI pipeline documentation for Trade.io.

## Documents

- [Testing Strategy](./strategy.md) - Test pyramid and approach
- [Local Development](./local-dev.md) - Setting up local environment
- [Test Data](./test-data.md) - Test data and factories
- [CI Pipeline](./ci-pipeline.md) - CI/CD workflow

## Test Pyramid

```
      /\
     /E2E\         <- 5%: Critical user flows
    /------\
   /  INT   \      <- 25%: API endpoints, DB queries
  /----------\
 /    UNIT    \    <- 70%: Business logic, utilities
/--------------\
```

## Testing Principles

1. **Fast Feedback**: Unit tests run in < 1 second
2. **Isolated**: Tests don't depend on each other
3. **Repeatable**: Same input = same output
4. **Meaningful**: Test behavior, not implementation
5. **Maintainable**: Clear, simple test code

## Test Coverage Goals

- **Overall**: > 80% code coverage
- **Critical Paths**: 100% coverage (orders, ledger, auth)
- **Edge Cases**: Explicit tests for boundaries
- **Error Paths**: Test all error scenarios

## Test Types

### Unit Tests (70%)

**What**: Test individual functions/classes in isolation.

**When**: For all business logic, utilities, validation.

**Tools**: Vitest

**Example**:

```typescript
describe('calculatePnL', () => {
  it('should calculate positive PnL for profitable trade', () => {
    const pnl = calculatePnL({
      costBasis: 100,
      currentValue: 120,
      quantity: 10,
    });
    expect(pnl).toBe(200); // (120-100) * 10
  });
});
```

### Integration Tests (25%)

**What**: Test multiple components together, including database.

**When**: For API endpoints, service interactions, database queries.

**Tools**: Vitest + Supertest (or similar)

**Example**:

```typescript
describe('POST /api/orders', () => {
  it('should create order and return 201', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(validOrderPayload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });
});
```

### E2E Tests (5%)

**What**: Test complete user workflows through UI.

**When**: For critical flows only (login, place order, view portfolio).

**Tools**: Playwright

**Example**:

```typescript
test('user can place market order', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  await page.click('text=Trade');
  await page.fill('[name=symbol]', 'AAPL');
  await page.fill('[name=quantity]', '10');
  await page.click('text=Buy');

  await expect(page.locator('text=Order submitted')).toBeVisible();
});
```

## Test Organization

```
src/
  services/
    orders/
      order.service.ts
      order.service.test.ts       # Unit tests
tests/
  integration/
    orders/
      order-api.test.ts           # Integration tests
  e2e/
    trading/
      place-order.spec.ts         # E2E tests
  factories/
    user.factory.ts               # Test data factories
  helpers/
    db.helper.ts                  # Test utilities
```

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode (for development)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npm test src/services/orders/order.service.test.ts
```

## Test Database

Integration tests use a separate test database:

```bash
# Set up test database
npm run db:test:setup

# Run migrations on test DB
npm run db:test:migrate

# Seed test data
npm run db:test:seed

# Reset test database
npm run db:test:reset
```

**Environment**: Use `.env.test` for test-specific config.

## Test Data Management

### Factories

Use factories for consistent test data:

```typescript
// tests/factories/user.factory.ts
export function createTestUser(overrides = {}) {
  return {
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    emailVerified: true,
    ...overrides,
  };
}
```

### Cleanup

Clean up after each test:

```typescript
afterEach(async () => {
  await db.order.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
});
```

Or use transactions that rollback:

```typescript
beforeEach(async () => {
  await db.$executeRaw`BEGIN`;
});

afterEach(async () => {
  await db.$executeRaw`ROLLBACK`;
});
```

## Mocking

### External Services

Mock external APIs (market data providers):

```typescript
vi.mock('../lib/market-data-client', () => ({
  getQuote: vi.fn().mockResolvedValue({
    symbol: 'AAPL',
    price: 150.0,
  }),
}));
```

### Time

Mock time for deterministic tests:

```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

// ... test code ...

vi.useRealTimers();
```

## CI Pipeline

Tests run on every PR:

1. Lint (ESLint, Prettier)
2. Type check (tsc)
3. Unit tests
4. Integration tests
5. E2E tests (on main branch only)
6. Coverage report

**CI must pass before merge.**

See [ci-pipeline.md](./ci-pipeline.md) for details.

## Performance Testing

For critical paths, add performance benchmarks:

```typescript
test('order placement completes in < 500ms', async () => {
  const start = Date.now();
  await orderService.placeOrder(params);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(500);
});
```

## Security Testing

Include security-focused tests:

```typescript
test('should reject order for unauthorized account', async () => {
  const otherUserToken = await createTestUser();

  await expect(
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ accountId: userAccount.id, ... })
  ).rejects.toThrow(ForbiddenError);
});
```

## Test Best Practices

### DO

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Arrange, Act, Assert pattern
- ✅ One assertion per test (usually)
- ✅ Test edge cases and errors
- ✅ Clean up after tests
- ✅ Use factories for test data

### DON'T

- ❌ Test framework internals
- ❌ Depend on test execution order
- ❌ Use real external services
- ❌ Hardcode dates/times
- ❌ Share mutable state between tests
- ❌ Skip cleanup
- ❌ Ignore flaky tests

## Continuous Improvement

- Review coverage reports regularly
- Add tests for bug fixes
- Refactor hard-to-test code
- Keep tests fast
- Remove obsolete tests

---

**Next**: See [local-dev.md](./local-dev.md) for local development setup.
