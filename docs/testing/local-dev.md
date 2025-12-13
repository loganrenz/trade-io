# Local Development Setup

## Prerequisites

- **Node.js**: 20.x or higher (use nvm: `nvm install 20`)
- **npm**: 9.x or higher (comes with Node.js)
- **Docker**: 20.x or higher (for local database)
- **Git**: Latest version

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/loganrenz/trade-io.git
cd trade-io
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your local configuration:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradeio_dev"

# Auth (will be configured after tech decisions)
AUTH_SECRET="your-secret-key-min-32-chars"

# Market Data (get free API key from provider)
MARKET_DATA_API_KEY="your-api-key"
MARKET_DATA_BASE_URL="https://api.polygon.io"

# App
NODE_ENV="development"
PORT=3000
LOG_LEVEL="debug"

# Redis
REDIS_URL="redis://localhost:6379"
```

### 4. Start Local Services (Docker Compose)

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 5. Run Database Migrations

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 6. Start Development Server

```bash
npm run dev
```

Visit: `http://localhost:3000`

## Docker Compose Services

The `docker-compose.yml` file includes:

### PostgreSQL

- **Port**: 5432
- **Database**: tradeio_dev
- **User**: postgres
- **Password**: postgres

### Redis

- **Port**: 6379
- **No password** (development only)

### pgAdmin (Optional)

- **Port**: 5050
- **Email**: admin@trade.io
- **Password**: admin

## Development Workflow

### Running Tests

```bash
# Unit tests only
npm run test:unit

# Integration tests (requires DB)
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Linting and Formatting

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

### Database Commands

```bash
# Generate Prisma client
npm run db:generate

# Create migration
npm run db:migrate:create <name>

# Apply migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:rollback

# Reset database (⚠️ deletes all data)
npm run db:reset

# Seed data
npm run db:seed

# Open Prisma Studio (DB GUI)
npm run db:studio
```

### Debugging

#### VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Dev Server",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "skipFiles": ["<node_internals>/**"],
  "console": "integratedTerminal"
}
```

#### Chrome DevTools

```bash
node --inspect node_modules/.bin/nuxt dev
```

Open: `chrome://inspect`

### Logs

Logs are written to:

- **Console**: Structured JSON in development
- **File**: `logs/app.log` (if configured)

Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`

## Troubleshooting

### "Cannot connect to database"

```bash
# Check Docker services
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check DATABASE_URL in .env.local
```

### "Port already in use"

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port in .env.local
PORT=3001
```

### "Module not found"

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### "Prisma client out of sync"

```bash
npm run db:generate
```

### "Migration failed"

```bash
# Rollback
npm run db:migrate:rollback

# Fix migration
# Edit migration file

# Apply again
npm run db:migrate
```

## IDE Setup

### VS Code Extensions

Recommended extensions (`.vscode/extensions.json`):

- ESLint
- Prettier
- Volar (Vue)
- Prisma
- GitLens
- Error Lens

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Environment-Specific Notes

### Development

- Hot reload enabled
- Verbose logging
- Source maps enabled
- Database seeded with test data

### Test

- Separate test database
- Faster execution (no watchers)
- Coverage enabled

### Staging

- Production-like environment
- Real external services
- Reduced logging

### Production

- Optimized builds
- Minimal logging
- Error tracking enabled

## Next Steps

1. Review architecture docs: `docs/architecture/`
2. Pick first issue: `docs/issues/0001-repo-baseline.md`
3. Follow workflow in `AGENTS.md`

## Support

- **Documentation**: `docs/`
- **Issues**: GitHub Issues
- **Agent Workflow**: `AGENTS.md`
