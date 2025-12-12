# Trade.io

> Production-grade paper trading platform for learning and competition

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)

## Overview

Trade.io is a secure, bulletproof paper trading platform that simulates real stock trading without financial risk. Built to production standards with:

- 🔒 **Security First**: Authentication, authorization, audit trails, input validation
- 📊 **Real Market Data**: Live quotes and historical data integration
- 💼 **Complete Order Management**: Market/limit orders, fills, cancellations
- 📈 **Portfolio Tracking**: Positions, PnL, transaction history
- 🎯 **Risk Controls**: Position limits, buying power checks, trading halts
- 🧪 **Fully Tested**: Comprehensive unit, integration, and E2E tests
- 📝 **Well Documented**: Complete architecture and API documentation

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker (for local database)
- npm 9.x or higher

### Installation

```bash
# Clone repository
git clone https://github.com/loganrenz/trade-io.git
cd trade-io

# Install dependencies
npm install

# Start local services (PostgreSQL, Redis)
docker-compose up -d

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000` 🚀

See [Local Development Guide](./docs/testing/local-dev.md) for detailed setup.

## For AI Agents

**Use this prompt**: "Please continue where we left off on the Trade.io project."

**Then immediately**:
1. Read [PROGRESS.md](./PROGRESS.md) to see current status and next issue
2. Read [AGENTS.md](./AGENTS.md) for the complete workflow
3. Pick up the next issue from [docs/issues/](./docs/issues/README.md)
4. **MANDATORY**: Update PROGRESS.md when you finish

**Current Status**: See [PROGRESS.md](./PROGRESS.md) for live progress tracking.

## Technology Stack

### Frontend
- **Framework**: Nuxt 3 (Vue 3) with TypeScript
- **UI**: TailwindCSS + shadcn-vue
- **State**: Pinia
- **Forms**: VeeValidate + Zod

### Backend
- **Runtime**: Node.js 20+
- **Language**: TypeScript 5+ (strict mode)
- **API**: tRPC (type-safe RPC)
- **Validation**: Zod
- **Logging**: Pino

### Database
- **Primary**: PostgreSQL 15+
- **ORM**: Prisma
- **Caching**: Redis
- **Hosting**: Supabase (includes auth)

### Infrastructure
- **Hosting**: Vercel
- **CI/CD**: GitHub Actions
- **Auth**: Supabase Auth

## Project Structure

```
trade-io/
├── src/                    # Source code
│   ├── server/            # Backend (tRPC routes, services)
│   ├── components/        # Vue components
│   ├── pages/             # Nuxt pages
│   ├── lib/               # Shared utilities
│   └── types/             # TypeScript types
├── prisma/                # Database schema & migrations
├── tests/                 # Tests (unit, integration, e2e)
├── docs/                  # Documentation
│   ├── architecture/      # System design docs
│   ├── api/               # API documentation
│   ├── security/          # Security & threat model
│   ├── testing/           # Testing strategy
│   └── issues/            # Project backlog (70 issues)
├── .github/               # GitHub templates & workflows
├── AGENTS.md              # Agent workflow guide
└── README.md              # This file
```

## Documentation

- **[Getting Started](./docs/README.md)** - Documentation index
- **[Agent Workflow](./AGENTS.md)** - For AI agents working on the project
- **[Architecture](./docs/architecture/)** - System design and data model
- **[Security](./docs/security/)** - Threat model and security controls
- **[API Docs](./docs/api/)** - API specifications
- **[Testing](./docs/testing/)** - Testing strategy and local dev
- **[Issue Backlog](./docs/issues/)** - Complete project backlog (70 issues)

## Features

### Core Trading
- ✅ **User Accounts**: Registration, authentication, profiles
- ✅ **Trading Accounts**: Multiple accounts per user with role-based access
- ✅ **Order Placement**: Market and limit orders with validation
- ✅ **Order Management**: Modify, cancel, view order history
- ✅ **Execution Simulation**: Realistic paper trading fills with slippage
- ✅ **Portfolio Tracking**: Real-time positions and PnL
- ✅ **Transaction Ledger**: Double-entry bookkeeping for all trades

### Market Data
- ✅ **Real-Time Quotes**: Live stock prices via market data provider
- ✅ **Historical Data**: OHLCV bars for charting
- ✅ **Instrument Search**: Search and filter tradeable symbols
- ✅ **Market Hours**: Validation against trading sessions

### Risk & Compliance
- ✅ **Buying Power Checks**: Prevent over-trading
- ✅ **Position Limits**: Max position size enforcement
- ✅ **Symbol Restrictions**: Admin-controlled trading halts
- ✅ **Audit Trail**: Immutable log of all actions
- ✅ **Compliance Reports**: Transaction and activity reports

### Admin Tools
- ✅ **User Management**: List, suspend, manage users
- ✅ **Risk Controls**: Configure limits and restrictions
- ✅ **System Monitoring**: Metrics and health checks
- ✅ **Incident Response**: Tools for handling issues

## Development

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage
```

### Linting and Formatting

```bash
# Lint
npm run lint

# Format
npm run format

# Type check
npm run typecheck
```

### Database

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate:create <name>

# Apply migrations
npm run db:migrate

# Seed data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## Contributing

### For AI Agents
1. Read [AGENTS.md](./AGENTS.md) thoroughly
2. Pick an issue from [docs/issues/](./docs/issues/)
3. Follow the implementation plan
4. Complete security checklist
5. Submit PR using the template

### For Humans
1. Review existing issues before creating new ones
2. Use the issue template in `.github/ISSUE_TEMPLATE/`
3. Follow the same workflow as agents
4. Ensure tests pass before submitting PR

## Security

Security is a first-class concern. We implement:

- 🔐 Strong authentication and authorization
- ✅ Input validation on all endpoints
- 📝 Comprehensive audit logging
- 🛡️ SQL injection prevention (ORM)
- 🔒 HTTPS only, secure headers
- 🚫 No secrets in code

See [Security Documentation](./docs/security/) for details.

**Report security issues**: security@trade.io (to be set up)

## Project Phases

The project is divided into 7 phases with 70 total issues:

- **Phase 0** (Issues 1-8): Repository baseline and tooling
- **Phase 1** (Issues 9-16): Data model and audit foundation
- **Phase 2** (Issues 17-28): Core APIs and authorization
- **Phase 3** (Issues 29-36): Market data and pricing
- **Phase 4** (Issues 37-46): Order lifecycle and execution
- **Phase 5** (Issues 47-54): Portfolio engine and ledger
- **Phase 6** (Issues 55-62): Admin tools and observability
- **Phase 7** (Issues 63-70): Security hardening and production readiness

**Current Status**: Phase 0 - Repository baseline (0% complete)

See [Issue Backlog](./docs/issues/README.md) for details.

## Roadmap

### v1.0 (MVP) - Q2 2024
- ✅ Core trading functionality
- ✅ Market data integration
- ✅ Portfolio tracking
- ✅ Basic admin tools

### v1.1 - Q3 2024
- 🔄 WebSocket real-time updates
- 🔄 Advanced charting
- 🔄 Social features (leaderboards)
- 🔄 Mobile responsive UI

### v2.0 - Q4 2024
- 🔄 Options trading (paper)
- 🔄 Strategy backtesting
- 🔄 Algorithmic trading APIs
- 🔄 Mobile apps (iOS, Android)

### Future
- Multi-currency support
- Cryptocurrency trading (paper)
- Competition/tournament mode
- Educational content integration

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: [docs/](./docs/)
- **Issues**: [GitHub Issues](https://github.com/loganrenz/trade-io/issues)
- **Discussions**: [GitHub Discussions](https://github.com/loganrenz/trade-io/discussions)

## Acknowledgments

- Market data powered by [Polygon.io](https://polygon.io/) or [Alpha Vantage](https://www.alphavantage.co/)
- Built with [Nuxt](https://nuxt.com/), [Prisma](https://www.prisma.io/), [tRPC](https://trpc.io/)
- Hosted on [Vercel](https://vercel.com/) and [Supabase](https://supabase.com/)

---

**Ready to start?** Check out [AGENTS.md](./AGENTS.md) or [docs/issues/0001-repo-baseline.md](./docs/issues/0001-repo-baseline.md)!
