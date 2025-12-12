# Trade.io Documentation

> Production-grade paper trading platform documentation

## Quick Links

- [Getting Started](#getting-started)
- [Architecture](./architecture/README.md)
- [Security](./security/README.md)
- [API Documentation](./api/README.md)
- [Testing](./testing/README.md)
- [Issue Backlog](./issues/README.md)

## Getting Started

### For Developers

1. **Read the Agent Workflow Guide**: See [AGENTS.md](../AGENTS.md) in the root
2. **Pick an issue**: Start with [docs/issues/README.md](./issues/README.md)
3. **Set up your environment**: Follow [testing/local-dev.md](./testing/local-dev.md)
4. **Make changes**: Follow the workflow in AGENTS.md
5. **Submit PR**: Use the PR template

### For Architects

1. **System Architecture**: [architecture/system-overview.md](./architecture/system-overview.md)
2. **Data Model**: [architecture/data-model.md](./architecture/data-model.md)
3. **API Design**: [api/design-principles.md](./api/design-principles.md)
4. **Security Model**: [security/threat-model.md](./security/threat-model.md)

## Project Overview

Trade.io is a paper trading platform designed to production standards. It provides:

- **Account Management**: User accounts with role-based access control
- **Order Management**: Full order lifecycle (place, modify, cancel, fill)
- **Market Data**: Real-time market data ingestion and pricing
- **Portfolio Tracking**: Positions, holdings, PnL, and ledgers
- **Audit & Compliance**: Complete audit trail of all operations
- **Risk Management**: Position limits, buying power checks, symbol restrictions
- **Admin Tools**: User management, incident controls, system monitoring

## Technology Stack

### Frontend
- **Framework**: Nuxt 3 (Vue 3) - to be confirmed in Phase 0
- **State Management**: Pinia
- **UI Framework**: TailwindCSS + shadcn-vue
- **Forms**: Zod + VeeValidate
- **HTTP Client**: tRPC client or fetch

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+ (strict mode)
- **API**: tRPC or REST (to be decided in Phase 0)
- **Database ORM**: Prisma or Drizzle (to be decided in Phase 0)
- **Auth**: Supabase Auth, Clerk, or custom JWT (to be decided in Phase 0)
- **Validation**: Zod
- **Logging**: Pino

### Database
- **Primary Database**: PostgreSQL 15+
- **Caching**: Redis
- **Search**: PostgreSQL full-text search

### Infrastructure
- **Hosting**: Vercel, Railway, or Render (to be decided)
- **Database Hosting**: Supabase, Neon, or PlanetScale (to be decided)
- **CI/CD**: GitHub Actions
- **Monitoring**: To be determined

## Documentation Structure

### [Architecture](./architecture/)

System design, component boundaries, and technical decisions.

- [System Overview](./architecture/system-overview.md) - High-level architecture
- [Data Model](./architecture/data-model.md) - Database schema and entities
- [Service Boundaries](./architecture/service-boundaries.md) - Service separation
- [Event System](./architecture/event-system.md) - Audit and event-sourcing patterns
- [Technology Decisions](./architecture/technology-decisions.md) - ADRs and rationale

### [Security](./security/)

Security model, threat analysis, and compliance.

- [Threat Model](./security/threat-model.md) - Security threats and mitigations
- [Authentication & Authorization](./security/auth.md) - AuthN/AuthZ model
- [Data Protection](./security/data-protection.md) - Encryption and privacy
- [Audit Logging](./security/audit-logging.md) - Audit trail requirements
- [Security Checklist](./security/checklist.md) - Pre-merge security review

### [API Documentation](./api/)

API specifications and integration guides.

- [API Overview](./api/README.md) - API design and conventions
- [Design Principles](./api/design-principles.md) - API design patterns
- [Endpoints](./api/endpoints/) - Individual endpoint specifications
- [Error Handling](./api/error-handling.md) - Error response formats
- [Versioning](./api/versioning.md) - API versioning strategy

### [Testing](./testing/)

Testing strategy, local development, and CI.

- [Testing Strategy](./testing/strategy.md) - Test pyramid and approach
- [Local Development](./testing/local-dev.md) - Setting up local environment
- [Test Data](./testing/test-data.md) - Test data and factories
- [CI Pipeline](./testing/ci-pipeline.md) - CI/CD workflow

### [Issue Backlog](./issues/)

Complete project backlog with detailed, agent-executable issues.

- [Issue Index](./issues/README.md) - All issues organized by phase
- Individual issues: `0001-repo-baseline.md`, `0002-db-schema-core.md`, etc.

## Key Concepts

### Paper Trading

This platform simulates real trading without real money:

- Orders are executed against real market data
- Fills are simulated based on market conditions
- No actual trades are placed with brokers
- Ideal for learning, testing strategies, or competitions

### Idempotency

All write operations support idempotency to prevent duplicate actions:

```typescript
POST /api/orders
Headers:
  Idempotency-Key: <client-generated-uuid>
```

Retry-safe: Same request with same key returns the same result.

### Audit Trail

Every state change is logged immutably:

- Who performed the action (actor)
- What action was performed
- When it occurred
- What resource was affected
- Additional context (metadata)
- Request correlation ID

### Authorization Model

Two-tier authorization:

1. **Authentication**: User identity verified (JWT, session, API key)
2. **Authorization**: User access checked (account membership, roles)

Users can belong to multiple accounts with different roles.

### Double-Entry Ledger

Financial transactions use double-entry bookkeeping:

- Every debit has a corresponding credit
- Ledger always balances (sum of all entries = 0)
- Provides complete audit trail of money movement

## Development Workflow

See [AGENTS.md](../AGENTS.md) for the complete workflow, but in brief:

1. **Pick an issue** from `docs/issues/`
2. **Create a branch**: `copilot/<issue-num>-<slug>`
3. **Implement** following the issue plan
4. **Test** thoroughly (unit + integration)
5. **Lint** and **type-check**
6. **Update docs** as needed
7. **Submit PR** using the template
8. **Mark issue done** after merge

## Phases and Milestones

The project is divided into phases (see [issues/README.md](./issues/README.md)):

- **Phase 0**: Repository baseline and tooling setup
- **Phase 1**: Data model and audit/event foundation
- **Phase 2**: Core APIs and authorization
- **Phase 3**: Market data and pricing service
- **Phase 4**: Order lifecycle and execution simulator
- **Phase 5**: Portfolio engine, ledger, and PnL
- **Phase 6**: Admin tooling and observability
- **Phase 7**: Security hardening and reliability

## Contributing

### For AI Agents

Follow [AGENTS.md](../AGENTS.md) strictly. Key points:

- Read the entire issue before starting
- Make minimal, focused changes
- Write tests for all new code
- Complete the security checklist
- Update documentation

### For Humans

1. Review existing issues before creating new ones
2. Use the issue template (`.github/ISSUE_TEMPLATE/agent_issue.md`)
3. Follow the same workflow as agents
4. Coordinate with the team on Slack/Discord

## Resources

### External Documentation

- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
- [Nuxt 3 Docs](https://nuxt.com/docs) (or Next.js if chosen)

### Learning Resources

- [Double-Entry Bookkeeping Basics](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)
- [Financial Trading Terminology](https://www.investopedia.com/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)

## FAQ

### Why TypeScript strict mode?

Type safety prevents entire classes of bugs and makes refactoring safer.

### Why Zod for validation?

Zod provides runtime validation that matches TypeScript types, ensuring input safety.

### Why PostgreSQL?

PostgreSQL provides ACID guarantees, rich data types, and excellent JSON support.

### Why paper trading?

Paper trading removes regulatory and financial risk while providing realistic trading experience.

### Can this be adapted for real trading?

With significant additional work (broker integration, regulatory compliance, risk management), yes. But that's out of scope for this project.

## License

To be determined.

## Contact

- **Repository**: https://github.com/loganrenz/trade-io
- **Issues**: https://github.com/loganrenz/trade-io/issues
- **Discussions**: https://github.com/loganrenz/trade-io/discussions

---

**Next Steps**: Read [AGENTS.md](../AGENTS.md) and pick your first issue from [docs/issues/](./issues/)!
