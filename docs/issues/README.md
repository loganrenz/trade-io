# Issue Backlog

## Overview

This directory contains the complete project backlog for Trade.io. Each issue is a self-contained, agent-executable task with detailed implementation guidance.

## Issue Index

Total Issues: **70**

### Phase 0: Repository Baseline & Tooling (8 issues)

Foundation setup, technology decisions, and developer tooling.

- [ ] [0001: Repository Baseline Setup](./0001-repo-baseline.md) - **S** - Initialize project structure, package.json, .gitignore
- [ ] [0002: Technology Stack Decisions](./0002-tech-stack-decisions.md) - **M** - Finalize frontend/backend/DB choices, document ADRs
- [ ] [0003: Development Environment Setup](./0003-dev-environment.md) - **M** - Docker Compose, local DB, environment variables
- [ ] [0004: Linting and Formatting](./0004-linting-formatting.md) - **S** - ESLint, Prettier, TypeScript config
- [ ] [0005: Testing Framework Setup](./0005-testing-framework.md) - **M** - Vitest, test structure, CI integration
- [ ] [0006: CI/CD Pipeline](./0006-ci-cd-pipeline.md) - **M** - GitHub Actions for lint/test/build
- [ ] [0007: Database Client Setup](./0007-database-client.md) - **M** - Prisma/Drizzle setup, connection pooling
- [ ] [0008: Logging and Error Handling](./0008-logging-error-handling.md) - **S** - Pino setup, error classes

### Phase 1: Data Model & Audit Foundation (8 issues)

Core database schema and audit/event system.

- [ ] [0009: Initial Database Migration](./0009-initial-migration.md) - **M** - Users, accounts, account_members tables
- [ ] [0010: Audit Log Schema](./0010-audit-log-schema.md) - **S** - Audit log table and service
- [ ] [0011: Market Data Schema](./0011-market-data-schema.md) - **M** - Instruments, quotes, bars, trading sessions
- [ ] [0012: Trading Schema](./0012-trading-schema.md) - **L** - Orders, order events, executions, positions
- [ ] [0013: Ledger Schema](./0013-ledger-schema.md) - **M** - Ledger accounts, ledger entries (double-entry)
- [ ] [0014: Risk & Compliance Schema](./0014-risk-compliance-schema.md) - **S** - Risk limits, symbol restrictions
- [ ] [0015: Database Indexes](./0015-database-indexes.md) - **S** - Indexes for query performance
- [ ] [0016: Seed Data for Development](./0016-seed-data.md) - **M** - Test users, accounts, instruments

### Phase 2: Core APIs & Authorization (12 issues)

Authentication, authorization, and foundational API endpoints.

- [ ] [0017: Authentication Service](./0017-auth-service.md) - **L** - Login, signup, session management
- [ ] [0018: Authorization Middleware](./0018-authz-middleware.md) - **M** - Auth checks, RLS/query filters
- [ ] [0019: User API](./0019-user-api.md) - **M** - Get profile, update profile
- [ ] [0020: Account API - Read](./0020-account-api-read.md) - **S** - Get accounts, get account details
- [ ] [0021: Account API - Write](./0021-account-api-write.md) - **M** - Create account, manage members
- [ ] [0022: Input Validation Schemas](./0022-validation-schemas.md) - **M** - Zod schemas for all API inputs
- [ ] [0023: Error Response Standardization](./0023-error-responses.md) - **S** - Standard error formats
- [ ] [0024: Rate Limiting](./0024-rate-limiting.md) - **M** - Rate limiter middleware, per-endpoint config
- [ ] [0025: CORS and Security Headers](./0025-security-headers.md) - **S** - CORS, CSP, security headers
- [ ] [0026: Idempotency Support](./0026-idempotency.md) - **M** - Idempotency key handling
- [ ] [0027: Request Logging](./0027-request-logging.md) - **S** - Request/response logging
- [ ] [0028: Health Check Endpoint](./0028-health-check.md) - **S** - /health, /ready endpoints

### Phase 3: Market Data & Pricing (8 issues)

Market data ingestion, caching, and pricing service.

- [ ] [0029: Instrument API](./0029-instrument-api.md) - **M** - Search, get instrument details
- [ ] [0030: Market Data Provider Integration](./0030-market-data-provider.md) - **L** - Polygon.io or Alpha Vantage integration
- [ ] [0031: Quote Ingestion Service](./0031-quote-ingestion.md) - **M** - Real-time quote ingestion and storage
- [ ] [0032: Quote API](./0032-quote-api.md) - **S** - Get latest quote, quote history
- [ ] [0033: Bar Data Ingestion](./0033-bar-ingestion.md) - **M** - Historical OHLCV data ingestion
- [ ] [0034: Bar API](./0034-bar-api.md) - **S** - Get bars for charting
- [ ] [0035: Pricing Service](./0035-pricing-service.md) - **M** - Centralized pricing with Redis cache
- [ ] [0036: Trading Hours Validation](./0036-trading-hours.md) - **M** - Check market hours, session types

### Phase 4: Order Lifecycle & Execution (10 issues)

Complete order management and paper trading execution simulator.

- [ ] [0037: Order Placement API](./0037-order-placement.md) - **L** - Place market/limit orders with validation
- [ ] [0038: Order Validation Service](./0038-order-validation.md) - **M** - Validate symbol, quantity, buying power
- [ ] [0039: Order Modification API](./0039-order-modification.md) - **M** - Modify limit price, quantity
- [ ] [0040: Order Cancellation API](./0040-order-cancellation.md) - **S** - Cancel pending orders
- [ ] [0041: Order Query API](./0041-order-query.md) - **M** - Get orders, order history, pagination
- [ ] [0042: Execution Simulator Core](./0042-execution-simulator.md) - **L** - Market/limit order fill logic
- [ ] [0043: Partial Fill Support](./0043-partial-fills.md) - **M** - Partial order fills
- [ ] [0044: Time-in-Force Handling](./0044-time-in-force.md) - **M** - DAY, GTC, IOC, FOK
- [ ] [0045: Slippage Simulation](./0045-slippage-simulation.md) - **S** - Realistic slippage model
- [ ] [0046: Order Event System](./0046-order-events.md) - **M** - Event-sourced order history

### Phase 5: Portfolio & Ledger & PnL (8 issues)

Portfolio tracking, double-entry ledger, and PnL calculations.

- [ ] [0047: Ledger Service Core](./0047-ledger-service.md) - **L** - Double-entry ledger operations
- [ ] [0048: Execution Recording](./0048-execution-recording.md) - **M** - Record executions in ledger
- [ ] [0049: Cash Balance Calculation](./0049-cash-balance.md) - **S** - Derive cash balance from ledger
- [ ] [0050: Position Calculation](./0050-position-calculation.md) - **M** - Calculate positions from executions
- [ ] [0051: Position API](./0051-position-api.md) - **M** - Get positions, position history
- [ ] [0052: PnL Calculation](./0052-pnl-calculation.md) - **L** - Realized and unrealized PnL
- [ ] [0053: Portfolio Summary API](./0053-portfolio-summary.md) - **M** - Account value, holdings, performance
- [ ] [0054: Transaction History API](./0054-transaction-history.md) - **S** - Ledger transaction history

### Phase 6: Admin & Observability (8 issues)

Admin tooling, monitoring, and operational features.

- [ ] [0055: Admin Authentication](./0055-admin-auth.md) - **M** - Separate admin auth, role enforcement
- [ ] [0056: User Management Admin](./0056-user-management-admin.md) - **M** - List/suspend/delete users
- [ ] [0057: Risk Limit Management](./0057-risk-limit-management.md) - **M** - CRUD risk limits
- [ ] [0058: Symbol Restriction Management](./0058-symbol-restrictions.md) - **M** - Halt/restrict symbols
- [ ] [0059: Audit Log Query API](./0059-audit-log-query.md) - **M** - Search audit logs
- [ ] [0060: System Metrics Dashboard](./0060-metrics-dashboard.md) - **M** - Basic metrics (orders, users, etc.)
- [ ] [0061: Monitoring and Alerting](./0061-monitoring-alerting.md) - **L** - Log aggregation, error tracking
- [ ] [0062: Database Backup Strategy](./0062-backup-strategy.md) - **S** - Automated backups, restore process

### Phase 7: Hardening & Security (8 issues)

Security enhancements, performance optimization, and production readiness.

- [ ] [0063: Security Audit](./0063-security-audit.md) - **L** - Comprehensive security review
- [ ] [0064: Dependency Vulnerability Scanning](./0064-dependency-scanning.md) - **S** - npm audit, Dependabot
- [ ] [0065: Performance Testing](./0065-performance-testing.md) - **M** - Load testing, optimization
- [ ] [0066: Database Query Optimization](./0066-query-optimization.md) - **M** - Analyze slow queries, add indexes
- [ ] [0067: Concurrency Testing](./0067-concurrency-testing.md) - **M** - Test race conditions, deadlocks
- [ ] [0068: Incident Response Runbook](./0068-incident-runbook.md) - **S** - Incident response procedures
- [ ] [0069: Production Deployment Guide](./0069-deployment-guide.md) - **M** - Production deployment checklist
- [ ] [0070: Final Documentation Review](./0070-docs-review.md) - **S** - Review and polish all docs

## Issue Status Legend

- [ ] **READY** - Ready to be worked on
- [x] **DONE** - Completed and merged
- [🚧] **IN_PROGRESS** - Currently being worked on
- [🚫] **BLOCKED** - Blocked by dependencies

## Complexity Legend

- **S (Small)**: < 20k tokens, 2-4 hours
- **M (Medium)**: 20-50k tokens, 4-8 hours
- **L (Large)**: 50-80k tokens, 8-16 hours

## Dependency Graph

Issues should generally be completed in numerical order within each phase. Cross-phase dependencies:

- Phase 2 depends on Phase 1 (data model must exist)
- Phase 3 can be done in parallel with Phase 2 (after data model)
- Phase 4 depends on Phase 2 (auth) and Phase 3 (pricing)
- Phase 5 depends on Phase 4 (executions)
- Phase 6 can start after Phase 2 (admin needs auth)
- Phase 7 requires all previous phases complete

## How to Use This Backlog

### For Agents

1. Start with issue 0001
2. Read the entire issue file thoroughly
3. Follow the implementation plan step-by-step
4. Mark the issue done when complete
5. Move to the next issue

### For Humans

1. Review issues before starting a phase
2. Adjust scope or split issues if needed
3. Add new issues as needed
4. Keep issue files updated with progress

## Progress Tracking

**Overall Progress**: 0 / 70 issues (0%)

**Phase 0**: 0 / 8 (0%)
**Phase 1**: 0 / 8 (0%)
**Phase 2**: 0 / 12 (0%)
**Phase 3**: 0 / 8 (0%)
**Phase 4**: 0 / 10 (0%)
**Phase 5**: 0 / 8 (0%)
**Phase 6**: 0 / 8 (0%)
**Phase 7**: 0 / 8 (0%)

---

**Next Issue to Work On**: [0001: Repository Baseline Setup](./0001-repo-baseline.md)
