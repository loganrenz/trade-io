# System Overview

## Mission

Build a production-grade paper trading platform that simulates real trading with real market data but without actual financial risk.

## Core Capabilities

1. **User & Account Management**
   - User registration and authentication
   - Multiple accounts per user
   - Account roles and permissions
   - Profile management

2. **Trading Operations**
   - Place market and limit orders
   - Modify and cancel orders
   - View order status and history
   - Real-time order execution simulation

3. **Portfolio Management**
   - Track positions across symbols
   - Calculate realized and unrealized PnL
   - View holdings and cash balance
   - Performance metrics and analytics

4. **Market Data**
   - Real-time quote streaming
   - Historical price data
   - Symbol information
   - Trading hours and sessions

5. **Risk & Compliance**
   - Position limits enforcement
   - Buying power validation
   - Symbol restrictions
   - Trading halts

6. **Audit & Reporting**
   - Complete audit trail
   - Transaction history
   - Compliance reports
   - Admin activity logs

## System Context

```
┌─────────────────────────────────────────────────────────────┐
│                      External Systems                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐       ┌──────────────┐                   │
│  │ Market Data  │       │    Auth      │                   │
│  │  Provider    │       │  Provider    │                   │
│  │ (Polygon.io, │       │(Supabase,    │                   │
│  │  Alpha Vantage)      │ Clerk, etc.) │                   │
│  └──────┬───────┘       └──────┬───────┘                   │
│         │                      │                            │
└─────────┼──────────────────────┼────────────────────────────┘
          │                      │
          │                      │
┌─────────▼──────────────────────▼────────────────────────────┐
│                      Trade.io Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Web Application (Nuxt/Next)           │    │
│  └───────────────────────┬────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼────────────────────────────┐    │
│  │                   API Layer                         │    │
│  │        (tRPC or REST + Authentication)             │    │
│  └───────────┬──────────────────────┬─────────────────┘    │
│              │                      │                       │
│  ┌───────────▼──────────┐  ┌───────▼──────────┐           │
│  │   Business Logic     │  │  Data Access     │           │
│  │   Services           │  │  Layer (ORM)     │           │
│  └──────────────────────┘  └──────┬───────────┘           │
│                                    │                        │
│  ┌─────────────────────────────────▼───────────────────┐   │
│  │           PostgreSQL Database                       │   │
│  │      (Accounts, Orders, Positions, Audit Log)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Redis Cache                            │   │
│  │         (Sessions, Real-time Quotes)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## User Personas

### Trader (Primary)

- **Goals**: Learn trading, test strategies, track performance
- **Needs**: Easy order placement, real-time data, portfolio view
- **Pain Points**: Complex UIs, delayed data, unclear PnL

### Competition Participant

- **Goals**: Compete with others, climb leaderboard
- **Needs**: Fair execution, accurate scoring, social features
- **Pain Points**: Unfair advantages, bugs in scoring

### Administrator

- **Goals**: Manage users, monitor system, handle incidents
- **Needs**: Admin dashboard, user management, system controls
- **Pain Points**: Lack of visibility, manual processes

### Developer/Integrator

- **Goals**: Build on top of platform, automate strategies
- **Needs**: API access, documentation, SDKs
- **Pain Points**: Poor docs, breaking changes

## Core Workflows

### User Registration & Setup

1. User signs up with email/OAuth
2. Email verification (if applicable)
3. Create default cash account
4. Fund account with virtual cash
5. User can start trading

### Place Market Order

1. User selects symbol and quantity
2. System validates input (symbol exists, quantity positive)
3. System checks authorization (user owns account)
4. System checks buying power (sufficient funds)
5. System checks risk limits (position limits)
6. System creates order in PENDING status
7. System logs audit entry
8. Execution simulator picks up order
9. Simulator gets current market price
10. Simulator creates fill at market price
11. Ledger service records transaction
12. Portfolio service updates position
13. Order status updated to FILLED
14. User sees updated portfolio

### View Portfolio

1. User requests portfolio for account
2. System validates authorization
3. System queries positions (aggregated from fills)
4. System gets current market prices
5. System calculates unrealized PnL
6. System retrieves cash balance from ledger
7. System calculates total account value
8. System returns portfolio summary

### Cancel Order

1. User requests order cancellation
2. System validates authorization (user owns order)
3. System checks order status (only PENDING can be cancelled)
4. System updates order status to CANCELLED
5. System logs audit entry
6. System returns success response

## Data Domains

### Identity & Access

- Users
- Accounts
- Account Members (roles)
- Sessions/Tokens
- Permissions

### Trading

- Symbols/Instruments
- Orders
- Order Events
- Executions/Fills
- Positions (derived)

### Financial

- Ledger Accounts
- Ledger Entries (double-entry)
- Cash Balances (derived)
- PnL (calculated)

### Market Data

- Quotes (real-time)
- Bars (historical OHLCV)
- Price Snapshots
- Trading Sessions

### Compliance & Risk

- Audit Log
- Risk Limits
- Symbol Restrictions
- Trading Halts

### Admin

- User Management
- System Configuration
- Feature Flags
- Incident Controls

## Quality Attributes

### Security

- **Authentication**: Every request authenticated
- **Authorization**: Explicit access checks
- **Audit**: Complete audit trail
- **Input Validation**: All inputs validated
- **Encryption**: TLS in transit, at rest (DB default)

### Performance

- **Response Time**: < 200ms for reads, < 500ms for writes (p95)
- **Throughput**: Support 100+ concurrent users initially
- **Scalability**: Horizontal scaling via stateless services
- **Caching**: Redis for hot data (quotes, sessions)

### Reliability

- **Availability**: 99.9% uptime target
- **Data Integrity**: ACID transactions for critical operations
- **Backup**: Daily database backups
- **Recovery**: RPO < 24 hours, RTO < 2 hours

### Maintainability

- **Code Quality**: TypeScript strict mode, linting
- **Testing**: >80% code coverage target
- **Documentation**: Comprehensive docs for all subsystems
- **Monitoring**: Logging, metrics, alerting

### Usability

- **Responsive**: Works on desktop and mobile
- **Intuitive**: Clear navigation and workflows
- **Fast**: Optimistic UI updates
- **Accessible**: WCAG 2.1 AA compliance target

## Technical Constraints

### Must Have

- TypeScript for type safety
- PostgreSQL for data integrity
- Zod for runtime validation
- Comprehensive test coverage
- No secrets in code

### Should Have

- tRPC for type-safe APIs (or well-typed REST)
- Prisma/Drizzle for type-safe database access
- Modern frontend framework (Nuxt/Next)
- Redis for caching and sessions
- CI/CD automation

### Nice to Have

- WebSocket for real-time updates
- Background job processing
- Multi-currency support
- Mobile app (future)

## Assumptions

1. **Paper Trading Only**: No real money, no broker integration
2. **Single Currency**: USD only initially
3. **US Markets**: Focus on US stocks initially
4. **Market Hours**: Respect US market hours
5. **No Shorting**: Only long positions initially
6. **No Margin**: Cash accounts only
7. **No Options**: Stocks only initially
8. **Deterministic Fills**: Simplified execution model

## Future Enhancements (Out of Scope for v1)

- Real money trading (requires regulatory compliance)
- Options, futures, forex
- Short selling and margin
- Social features (following traders, copy trading)
- Strategy backtesting
- Algorithmic trading APIs
- Mobile native apps
- Multi-region deployment
- Advanced charting
- News and sentiment analysis

## Success Metrics

### User Engagement

- Daily active users
- Orders placed per user per day
- Session duration
- Return rate (weekly)

### System Health

- API error rate < 0.1%
- API latency p95 < 500ms
- Database query performance
- Cache hit rate > 90%

### Data Quality

- Order fill accuracy
- PnL calculation correctness
- Ledger balancing (always balanced)
- Audit log completeness

---

**Next**: Review [Data Model](./data-model.md) for detailed schema.
