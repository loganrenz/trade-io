# Agent Workflow Guide

## Overview

This document defines the canonical workflow for AI agents working on the Trade.io paper trading platform. Every agent must follow these guidelines to ensure consistency, security, and quality.

## Project Mission

Build a secure, production-grade paper trading platform (E*TRADE-like) with:
- Robust account management and authorization
- Real-time market data integration
- Complete order lifecycle management
- Portfolio tracking, positions, and PnL
- Audit trails and compliance features
- Admin tooling and risk controls

## Quick Start for Agents

### 1. Pick an Issue

Issues are stored in `docs/issues/` with numbered prefixes:
- `docs/issues/0001-repo-baseline.md`
- `docs/issues/0002-db-schema-core.md`
- etc.

**Issue Selection Rules:**
1. Work issues in numerical order unless directed otherwise
2. Check issue status comments in the file header
3. Verify dependencies are complete before starting
4. Issues marked `[BLOCKED]` cannot be started yet

### 2. Branch Naming

Always use this format:
```
copilot/<issue-number>-<short-slug>
```

Examples:
- `copilot/0001-repo-baseline`
- `copilot/0023-order-placement-api`

### 3. Read the Issue Thoroughly

Each issue contains:
- **Goal**: What to accomplish
- **Context**: Why this matters
- **Scope**: What's included
- **Out of Scope**: What to avoid
- **Implementation Plan**: Step-by-step guide
- **Files to Create/Modify**: Exact file paths
- **Acceptance Criteria**: Definition of done
- **Tests Required**: What tests to write
- **Security Notes**: Security considerations
- **Estimated Complexity**: S/M/L size
- **Token Budget**: Reminder about window limits

### 4. Implementation Workflow

#### A. Initial Setup
```bash
# Verify you're on the right branch
git branch --show-current

# Install dependencies
npm install  # or pnpm install, yarn install

# Set up local environment
cp .env.example .env.local
# Edit .env.local with appropriate values
```

#### B. Make Minimal Changes
- Change ONLY what's specified in the issue
- Follow existing code patterns and conventions
- Add comprehensive comments only where complexity requires it
- Use TypeScript strict mode throughout

#### C. Run Linters
```bash
# Format code
npm run format

# Lint TypeScript/JavaScript
npm run lint

# Type check
npm run typecheck
```

#### D. Run Tests
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (if applicable)
npm run test:e2e

# All tests
npm test

# With coverage
npm run test:coverage
```

#### E. Database Migrations
When touching the database schema:

```bash
# Generate migration
npm run db:migrate:create <migration-name>

# Apply migrations (local)
npm run db:migrate

# Rollback (if needed)
npm run db:migrate:rollback

# Verify schema
npm run db:schema:verify
```

**Migration Rules:**
- Never edit existing migrations that have been merged
- Always test both `up` and `down` migrations
- Include data migrations separately from schema migrations
- Add indexes in separate migrations for large tables
- Document breaking changes in migration comments

#### F. Documentation Updates
When changes affect:
- **API**: Update `docs/api/` with endpoint specs
- **Architecture**: Update `docs/architecture/`
- **Security**: Update `docs/security/` if authZ/authN changes
- **Data Model**: Update `docs/architecture/data-model.md`

### 5. Commit Rules

#### Commit Message Format
```
<type>(<scope>): <short summary>

<detailed description if needed>

Refs: #<issue-number>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Build/tooling changes
- `security`: Security improvements

**Examples:**
```
feat(orders): add order placement API

Implements POST /api/orders endpoint with validation,
idempotency, and audit logging.

Refs: #0023

security(auth): add rate limiting to login endpoint

Prevents brute force attacks with 5 req/min limit.

Refs: #0012
```

#### Commit Frequency
- Commit logical units of work
- Each commit should pass tests
- Don't commit broken code
- Squash is OK, but keep logical separation

### 6. Definition of Done

Before marking an issue complete, verify ALL of these:

#### Code Quality
- [ ] All acceptance criteria met
- [ ] Code follows existing patterns and conventions
- [ ] TypeScript strict mode with no `any` types (unless justified)
- [ ] No linter errors or warnings
- [ ] No type errors
- [ ] All new code has appropriate comments/JSDoc

#### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing (if applicable)
- [ ] E2E tests written and passing (if applicable)
- [ ] Test coverage meets or exceeds project standards
- [ ] Edge cases covered
- [ ] Error paths tested

#### Security
- [ ] Security checklist reviewed (see below)
- [ ] No secrets in code or committed files
- [ ] Input validation added for all user inputs
- [ ] Authorization checks in place
- [ ] Audit logging added for state changes
- [ ] SQL injection risks mitigated
- [ ] XSS risks mitigated (if UI changes)

#### Database
- [ ] Migrations tested (up and down)
- [ ] Indexes added for query patterns
- [ ] Constraints enforced at DB level
- [ ] RLS policies updated (if using Supabase)
- [ ] Data model documentation updated

#### Documentation
- [ ] README updated if setup changes
- [ ] API docs updated if endpoints changed
- [ ] Architecture docs updated if design changed
- [ ] Security docs updated if authZ/authN changed
- [ ] Inline code comments for complex logic

#### CI/CD
- [ ] All CI checks passing
- [ ] No new warnings in build output
- [ ] Docker build succeeds (if applicable)
- [ ] Deployment config updated (if needed)

## Safety & Security

### Never Commit Secrets

**Prohibited:**
- API keys, tokens, passwords in code
- `.env` files (use `.env.example` as template)
- Private keys or certificates
- Database credentials
- Session secrets

**Allowed:**
- `.env.example` with placeholder values
- Public configuration
- Development-only safe defaults

### Environment Variable Hygiene

**Required environment variables:**
```bash
# Database
DATABASE_URL=              # Postgres connection string
DATABASE_POOL_SIZE=10      # Connection pool size

# Auth
AUTH_SECRET=               # Session/JWT secret (generate with crypto)
AUTH_PROVIDER=             # supabase | clerk | custom

# Market Data
MARKET_DATA_API_KEY=       # API key for market data provider
MARKET_DATA_BASE_URL=      # Base URL for market data API

# App
NODE_ENV=                  # development | staging | production
PORT=3000                  # Server port
LOG_LEVEL=info             # trace | debug | info | warn | error

# Redis (for caching/sessions)
REDIS_URL=                 # Redis connection string
```

**Loading order:**
1. `.env.local` (git-ignored, local dev overrides)
2. `.env.development` / `.env.production` (committed, environment defaults)
3. System environment variables (highest priority)

### Least Privilege Principles

**Database:**
- Application DB user should NOT have DDL privileges in production
- Use separate migration user for schema changes
- Read-only replicas for reporting queries

**API Access:**
- Every endpoint requires authentication (except public health checks)
- Authorization checks based on account membership
- API keys have scope limits

**Admin Operations:**
- Require elevated privileges
- Log all admin actions with actor
- Consider 2FA/approval workflow for destructive actions

### Row-Level Security (RLS) / ACL Guidelines

**If using Supabase (RLS):**
```sql
-- Example: Users can only see their own accounts
CREATE POLICY "users_own_accounts" ON accounts
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM account_members 
    WHERE account_id = accounts.id
  ));
```

**If using custom API (ACL):**
```typescript
// Example: Check user has access to account
async function checkAccountAccess(userId: string, accountId: string) {
  const membership = await db.accountMember.findFirst({
    where: { userId, accountId }
  });
  if (!membership) {
    throw new ForbiddenError('Access denied');
  }
  return membership;
}
```

**Principles:**
- Default deny (explicit allow only)
- Check at query time, not just endpoint level
- Verify on both read and write operations
- Audit denied access attempts

### Input Validation

**Use Zod for all inputs:**
```typescript
import { z } from 'zod';

const orderSchema = z.object({
  accountId: z.string().uuid(),
  symbol: z.string().min(1).max(10).toUpperCase(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().int().positive(),
  orderType: z.enum(['MARKET', 'LIMIT']),
  limitPrice: z.number().positive().optional(),
  timeInForce: z.enum(['DAY', 'GTC', 'IOC', 'FOK']),
});

// In handler
const validated = orderSchema.parse(req.body);
```

**Validation rules:**
- Validate all user inputs
- Validate at API boundary
- Sanitize for SQL/XSS
- Reject unknown fields
- Validate business rules (e.g., buying power)

### Audit Logging

**Every state change must be logged:**
```typescript
await db.auditLog.create({
  data: {
    actor: userId,
    action: 'ORDER_PLACED',
    resource: 'order',
    resourceId: order.id,
    metadata: {
      accountId: order.accountId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
    },
    requestId: req.id,
    ipAddress: req.ip,
    timestamp: new Date(),
  }
});
```

**Audit log is append-only:**
- Never UPDATE or DELETE audit logs
- Retention policy via archival, not deletion
- Include correlation IDs for request tracing

### Security Checklist for Every Issue

Before completing any issue, verify:

- [ ] **Authentication**: All endpoints require valid auth (except public APIs)
- [ ] **Authorization**: User can only access their own resources
- [ ] **Input Validation**: All inputs validated with Zod schemas
- [ ] **SQL Injection**: Using parameterized queries (ORM handles this)
- [ ] **XSS**: Outputs are escaped (framework handles this, but verify)
- [ ] **CSRF**: CSRF tokens on state-changing operations (if cookie auth)
- [ ] **Rate Limiting**: Applied to sensitive endpoints
- [ ] **Audit Logging**: State changes are logged
- [ ] **Secrets Management**: No secrets in code
- [ ] **Least Privilege**: DB/API access is minimally scoped
- [ ] **Error Handling**: Errors don't leak sensitive info
- [ ] **Dependencies**: No known vulnerabilities (`npm audit`)

## Testing Strategy

### Test Pyramid

```
      /\
     /E2E\         <- Few, slow, high value (smoke tests)
    /------\
   /  INT   \      <- Moderate, medium speed (API contracts)
  /----------\
 /    UNIT    \    <- Many, fast, focused (business logic)
/--------------\
```

**Unit Tests (70%):**
- Pure functions, business logic
- Validation schemas
- Utility functions
- No database, no network

**Integration Tests (25%):**
- API endpoints
- Database queries
- Service boundaries
- With test database

**E2E Tests (5%):**
- Critical user flows
- End-to-end scenarios
- Against full stack

### Test Organization

```
src/
  services/
    orders/
      order.service.ts
      order.service.test.ts      # Unit tests
tests/
  integration/
    orders/
      order-api.test.ts          # Integration tests
  e2e/
    order-flow.test.ts           # E2E tests
```

### Test Data

**Use factories for consistent test data:**
```typescript
// tests/factories/user.factory.ts
export function createTestUser(overrides = {}) {
  return {
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    ...overrides,
  };
}
```

**Cleanup after tests:**
```typescript
afterEach(async () => {
  await db.order.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
});
```

### CI Test Execution

CI will run:
1. Linters (ESLint, Prettier)
2. Type checking (tsc)
3. Unit tests
4. Integration tests (with test DB)
5. E2E tests (if applicable)
6. Coverage report

**CI must pass before merge.**

## Common Patterns

### Idempotency Keys

**For write operations:**
```typescript
async function placeOrder(params: OrderParams, idempotencyKey: string) {
  // Check if already processed
  const existing = await db.order.findUnique({
    where: { idempotencyKey }
  });
  if (existing) {
    return existing; // Return existing result
  }
  
  // Process new request
  const order = await db.order.create({
    data: { ...params, idempotencyKey }
  });
  return order;
}
```

### Optimistic Concurrency

**Use version/timestamp for concurrent updates:**
```typescript
async function updateOrder(orderId: string, updates: any, expectedVersion: number) {
  const result = await db.order.updateMany({
    where: { 
      id: orderId,
      version: expectedVersion // Only update if version matches
    },
    data: {
      ...updates,
      version: expectedVersion + 1
    }
  });
  
  if (result.count === 0) {
    throw new ConcurrencyError('Order was modified by another request');
  }
}
```

### Error Handling

**Use typed errors:**
```typescript
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

// In handler
try {
  const order = await orderService.place(params);
  return res.json(order);
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  // Log unexpected errors, return generic message
  logger.error(error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

## Issue Lifecycle

### Issue States

Issues progress through these states:

1. **READY**: Ready to be picked up
2. **IN_PROGRESS**: Agent is working on it
3. **IN_REVIEW**: PR submitted, awaiting review
4. **BLOCKED**: Waiting on dependency or decision
5. **DONE**: Merged and complete

### Marking Issues Done

When an issue is complete:
1. Update the issue file header with status and completion date
2. Update `docs/issues/README.md` progress tracker
3. Commit with message: `chore: mark issue #XXXX as complete`

### Reporting Blockers

If you encounter a blocker:
1. Document the blocker in the issue file
2. Update status to `[BLOCKED]`
3. Create a new issue for the blocker if needed
4. Note in commit message

## Getting Help

### Documentation Locations

- **Architecture**: `docs/architecture/`
- **API Specs**: `docs/api/`
- **Security**: `docs/security/`
- **Testing**: `docs/testing/`
- **Data Model**: `docs/architecture/data-model.md`

### Conventions Reference

- **Code Style**: ESLint + Prettier configs
- **Naming**: camelCase for variables/functions, PascalCase for classes/types
- **File Names**: kebab-case for files
- **Database**: snake_case for columns, camelCase in code (ORM maps)

### Before Asking Questions

1. Read the issue thoroughly
2. Check related documentation
3. Search closed issues for similar work
4. Review existing code patterns

## Platform-Specific Notes

### Stack Decisions (to be finalized in Phase 0)

**Frontend:**
- Framework: Nuxt 3 (Vue 3) or Next.js (React)
- State: Pinia (Vue) or Zustand (React)
- UI: TailwindCSS + shadcn/ui or similar
- Forms: Zod + form library

**Backend:**
- Runtime: Node.js 20+
- Language: TypeScript 5+
- API: tRPC or REST (Express/Fastify)
- Database ORM: Prisma or Drizzle
- Auth: Supabase Auth or Clerk or custom JWT

**Database:**
- Primary: PostgreSQL 15+
- Caching: Redis
- Search: PostgreSQL full-text or Typesense

**Infrastructure:**
- Hosting: Vercel / Railway / Render
- Database: Supabase / Neon / PlanetScale
- CI/CD: GitHub Actions

### Code Generation

Use code generators where available:
```bash
# Generate API types from schema
npm run codegen:api

# Generate database client
npm run db:generate

# Generate test boilerplate
npm run generate:test <file-path>
```

## Troubleshooting

### Common Issues

**Tests failing with DB errors:**
- Ensure test DB is running
- Run migrations on test DB
- Check connection string in test env

**Type errors after schema change:**
- Regenerate DB client: `npm run db:generate`
- Regenerate API types: `npm run codegen:api`
- Restart TypeScript server in editor

**Linter errors:**
- Run `npm run lint:fix` to auto-fix
- Check `.eslintrc.js` for rules
- Some rules require manual fixes

**Migration conflicts:**
- Never rebase already-merged migrations
- Create new migration to fix issues
- Coordinate with team on shared branches

## Token Budget Awareness

Each agent has a limited context window (~100k tokens including input and output).

**Token-saving strategies:**
1. Read only the files you need to modify
2. Use targeted searches instead of browsing
3. Focus on the current issue only
4. Refer to docs by name rather than reading entire docs
5. If you're running low, complete the minimum viable work and document next steps

**Issue sizing:**
- **S (Small)**: <20k tokens estimated (simple, focused changes)
- **M (Medium)**: 20-50k tokens estimated (moderate complexity)
- **L (Large)**: 50-80k tokens estimated (complex, multi-file changes)

If an issue seems too large, flag it for splitting.

## Final Checklist Before Completion

Before marking your work complete:

- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Linters passing
- [ ] Type checking passing
- [ ] Security checklist reviewed
- [ ] Documentation updated
- [ ] Migration tested (if applicable)
- [ ] No secrets committed
- [ ] Issue file updated with completion status
- [ ] PR description includes summary and testing notes

---

**Remember**: Quality over speed. A smaller, well-tested change is better than a large, untested one.
