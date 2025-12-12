# Architecture Documentation

## Overview

This directory contains the architectural documentation for Trade.io, a production-grade paper trading platform.

## Documents

### Core Architecture
- [System Overview](./system-overview.md) - High-level system architecture and components
- [Data Model](./data-model.md) - Complete database schema and entity relationships
- [Service Boundaries](./service-boundaries.md) - Service separation and communication patterns
- [Event System](./event-system.md) - Audit logging and event-sourcing patterns

### Technical Decisions
- [Technology Decisions](./technology-decisions.md) - ADRs (Architecture Decision Records) and rationale
- [Concurrency Strategy](./concurrency-strategy.md) - Handling concurrent operations safely
- [Idempotency](./idempotency.md) - Ensuring operations can be safely retried

### Subsystems
- [Order Lifecycle](./order-lifecycle.md) - Order state machine and execution flow
- [Portfolio Engine](./portfolio-engine.md) - Position tracking and PnL calculations
- [Ledger System](./ledger-system.md) - Double-entry bookkeeping implementation
- [Market Data](./market-data.md) - Data ingestion and pricing service
- [Execution Simulator](./execution-simulator.md) - Paper trading fill simulation

## Architecture Principles

### 1. Security First
- Defense in depth
- Principle of least privilege
- Audit everything
- Validate all inputs
- Fail securely

### 2. Data Integrity
- ACID transactions where needed
- Optimistic concurrency control
- Idempotent operations
- Immutable audit logs
- Double-entry ledger for money

### 3. Testability
- Clear service boundaries
- Dependency injection
- Pure functions where possible
- Test data factories
- Integration test support

### 4. Maintainability
- Clear separation of concerns
- Consistent patterns
- Comprehensive documentation
- Type safety (TypeScript strict)
- Meaningful error messages

### 5. Performance
- Appropriate indexing
- Caching strategy
- Efficient queries
- Background job support
- Horizontal scalability

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│  (Web UI - Nuxt/Next, Mobile - Future)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS / tRPC or REST
                     │
┌────────────────────▼────────────────────────────────────┐
│                  API Gateway                            │
│  (Auth, Rate Limiting, Request Validation)             │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Order   │  │Portfolio │  │  Admin   │
│ Service  │  │ Service  │  │ Service  │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │              │
     └─────────────┼──────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Ledger Service │
         │  (Double-Entry) │
         └────────┬─────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Market  │  │  Audit  │  │  Risk   │
│  Data   │  │  Log    │  │ Engine  │
│ Service │  │ Service │  │ Service │
└─────────┘  └─────────┘  └─────────┘
     │            │            │
     └────────────┼────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   PostgreSQL    │
         │   (Primary DB)  │
         └─────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
    ┌────────┐      ┌──────────┐
    │ Redis  │      │Background│
    │(Cache) │      │  Jobs    │
    └────────┘      └──────────┘
```

## Data Flow Examples

### Place Order Flow
```
1. Client → API Gateway: POST /api/orders
2. API Gateway → Auth: Validate token
3. API Gateway → Order Service: Place order request
4. Order Service → Account Service: Check buying power
5. Order Service → Risk Engine: Check position limits
6. Order Service → Database: Create order (PENDING)
7. Order Service → Audit Log: Log order creation
8. Order Service → Execution Simulator: Queue for execution
9. Execution Simulator → Market Data: Get current price
10. Execution Simulator → Database: Create fill
11. Execution Simulator → Ledger Service: Record transaction
12. Ledger Service → Database: Create ledger entries
13. Portfolio Service → Database: Update positions (derived)
14. Order Service → Client: Return order response
```

### Real-Time Market Data Flow
```
1. Market Data Provider → Ingestion Service: WebSocket stream
2. Ingestion Service → Validation: Validate data
3. Ingestion Service → Database: Write to quotes table
4. Ingestion Service → Redis: Cache latest quote
5. Pricing Service → Redis: Read cached quote
6. Pricing Service → Client: Serve quote via API
```

## Service Descriptions

### Order Service
Manages the complete order lifecycle:
- Order placement with validation
- Order modification and cancellation
- Order status tracking
- Integration with execution simulator

### Portfolio Service
Tracks user positions and performance:
- Position aggregation from fills
- PnL calculation (realized and unrealized)
- Holdings valuation
- Performance metrics

### Ledger Service
Double-entry bookkeeping for all money movement:
- Cash deposits and withdrawals
- Trade executions (debit/credit)
- Fees and commissions
- Dividends and corporate actions
- Ledger balancing and reconciliation

### Market Data Service
Ingests and serves market data:
- Real-time quote ingestion
- Historical bar data
- Price snapshots
- Symbol metadata

### Execution Simulator
Simulates order fills for paper trading:
- Market order immediate fill
- Limit order conditional fill
- Partial fills
- Slippage simulation
- Time-in-force handling

### Risk Engine
Enforces risk limits:
- Position size limits
- Concentration limits
- Buying power checks
- Symbol restrictions
- Trading hours validation

### Audit Log Service
Immutable append-only audit trail:
- All state changes logged
- Actor attribution
- Request correlation
- Compliance reporting

### Admin Service
Administrative operations:
- User management
- Risk limit configuration
- Symbol allowlist/blocklist
- System controls (halt trading)
- Incident response tools

## Technology Stack Decisions

To be finalized in Phase 0 issues, but likely choices:

### Backend
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 20+
- **API Framework**: tRPC (type-safe) or Express/Fastify (REST)
- **ORM**: Prisma (dev experience) or Drizzle (performance)
- **Validation**: Zod
- **Testing**: Vitest (unit), Supertest (integration)

### Frontend
- **Framework**: Nuxt 3 (Vue) or Next.js 14 (React)
- **State**: Pinia (Vue) or Zustand (React)
- **Forms**: VeeValidate + Zod or React Hook Form + Zod
- **UI**: TailwindCSS + shadcn-vue/ui

### Database
- **Primary**: PostgreSQL 15+
- **Caching**: Redis
- **Search**: PostgreSQL full-text

### Infrastructure
- **Hosting**: Vercel, Railway, or Render
- **Database**: Supabase, Neon, or PlanetScale
- **CI/CD**: GitHub Actions
- **Monitoring**: To be determined (Sentry, LogRocket, etc.)

## Scalability Considerations

### Current Scope (Phase 0-7)
- Single region deployment
- Vertical scaling (larger instances)
- Read replicas for reporting
- Redis caching for hot data
- Connection pooling

### Future Enhancements (Out of Scope)
- Multi-region deployment
- Sharding by account
- Event-driven architecture (message queues)
- Separate read/write services (CQRS)
- Real-time WebSocket updates

## Security Architecture

See [../security/](../security/) for detailed security documentation.

Key security layers:
1. **Network**: HTTPS only, CORS configured
2. **Authentication**: JWT or session-based
3. **Authorization**: Role-based + account-based
4. **Input**: Zod validation on all inputs
5. **Database**: RLS or query-level authZ checks
6. **Audit**: All actions logged with actor
7. **Secrets**: Environment variables, never in code

## Deployment Architecture

### Development
- Local PostgreSQL (Docker Compose)
- Local Redis (Docker Compose)
- Environment: `.env.local`
- Hot reload enabled

### Staging
- Cloud PostgreSQL (Supabase/Neon/PlanetScale)
- Cloud Redis
- Environment: `.env.staging`
- CI deployment on merge to `develop`

### Production
- Cloud PostgreSQL with backups
- Cloud Redis with persistence
- Environment: `.env.production`
- CI deployment on merge to `main`
- Manual approval gate

## File Organization

```
src/
  lib/              # Shared utilities
  services/
    orders/         # Order service
    portfolio/      # Portfolio service
    ledger/         # Ledger service
    market-data/    # Market data service
    execution/      # Execution simulator
    risk/           # Risk engine
    audit/          # Audit logging
    admin/          # Admin operations
  api/              # API routes/handlers
  db/               # Database client, migrations
  types/            # Shared TypeScript types
  middleware/       # Auth, validation, logging
  config/           # Configuration loading
```

## Next Steps

1. Review [Technology Decisions](./technology-decisions.md) for ADRs
2. Review [Data Model](./data-model.md) for complete schema
3. Review [Service Boundaries](./service-boundaries.md) for API contracts
4. Begin Phase 0 issues to establish baseline

---

**Document Status**: Living document, will be updated as decisions are made and implementation progresses.
