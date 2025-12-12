# ADR 0005: Database Hosting Selection

## Status
**Accepted** - 2025-12-12

## Context
We need to choose a PostgreSQL hosting provider for our production database. Requirements include:
- **Performance**: Low latency, efficient query execution
- **Reliability**: High uptime SLA (99.9%+), automated backups
- **Security**: Encryption at rest and in transit, network isolation
- **Scalability**: Ability to scale compute and storage independently
- **Developer Experience**: Easy setup, migration tools, GUI for DB management
- **Cost**: Reasonable pricing for both development and production
- **Integration**: Works well with our chosen auth provider and ORM (Prisma)
- **Row-Level Security**: PostgreSQL RLS support for authorization
- **Connection pooling**: Built-in or easy to add connection management
- **Monitoring**: Query performance insights, slow query detection

The platform requires a reliable, performant database that can scale as user adoption grows.

## Decision
**We will use Supabase for PostgreSQL hosting.**

## Rationale

### Why Supabase
1. **Integrated auth**: Same provider for authentication and database (RLS integration)
2. **Built-in features**: RESTful API, Realtime subscriptions, Storage
3. **Row-Level Security**: Native PostgreSQL RLS with auth.uid() helper
4. **Connection pooling**: PgBouncer included for connection management
5. **Database GUI**: Built-in SQL editor and table viewer
6. **Auto-generated APIs**: Instant REST and GraphQL APIs (optional use)
7. **Generous free tier**: 500MB database, 50,000 monthly active users
8. **Backups**: Daily automated backups with point-in-time recovery
9. **Extensions**: Support for popular PostgreSQL extensions (pgvector, postgis, etc.)
10. **Open source**: Based on PostgreSQL, can self-host if needed

### Why Supabase over Alternatives
1. **Unified platform**: Auth, database, storage, and realtime in one service
2. **RLS integration**: Seamless authorization at database level
3. **Developer-friendly**: Excellent documentation, quick setup
4. **Cost-effective**: Free tier suitable for development, affordable for production

### Alternatives Considered

#### Neon
**Pros:**
- Serverless PostgreSQL with instant scaling
- Generous free tier (10GB storage)
- Branching for development databases
- Excellent cold start performance
- Modern architecture (separates compute and storage)

**Cons:**
- No built-in auth (need separate provider)
- No realtime subscriptions
- Newer service (less battle-tested)
- No RLS integration helper functions

**Decision:** Supabase's integrated auth and RLS outweigh Neon's serverless benefits.

#### PlanetScale
**Pros:**
- Excellent developer experience
- Database branching for development
- Automatic sharding and scaling
- Generous free tier

**Cons:**
- MySQL-based, not PostgreSQL
- No foreign keys (affects data integrity)
- Different SQL dialect
- No RLS support

**Decision:** We need PostgreSQL for RLS and advanced features. MySQL's limitations are dealbreakers.

#### AWS RDS (PostgreSQL)
**Pros:**
- Enterprise-grade reliability
- Extensive AWS ecosystem integration
- Flexible instance sizing
- Multi-AZ deployments
- Proven at massive scale

**Cons:**
- More expensive than managed alternatives
- Complex setup and configuration
- No built-in connection pooling (need RDS Proxy)
- Requires more DevOps knowledge
- No free tier

**Decision:** Too expensive and complex for our needs. Managed alternatives provide better DX.

#### Railway
**Pros:**
- Simple deployment
- Generous free tier
- Good for small projects
- Easy environment management

**Cons:**
- Smaller company (reliability concerns)
- Less mature than alternatives
- No specialized database features
- Basic monitoring

**Decision:** Supabase is more specialized for database hosting and has better features.

#### Vercel Postgres (powered by Neon)
**Pros:**
- Integrated with Vercel deployment
- Serverless PostgreSQL
- Simple setup

**Cons:**
- Same limitations as Neon (no auth, no RLS)
- Tightly coupled to Vercel
- More expensive at scale

**Decision:** Supabase provides more features and better flexibility.

## Consequences

### Positive
- **Fast setup**: Database ready in minutes with auth configured
- **RLS support**: Database-level authorization with auth.uid()
- **Connection pooling**: PgBouncer included, no additional setup
- **Backups**: Automated daily backups with point-in-time recovery
- **Cost-effective**: Free tier for development, $25/month for production starter
- **Monitoring**: Query performance insights in dashboard
- **Extensions**: Can enable pgvector (for AI), postgis (for location), etc.
- **Realtime**: Optional realtime subscriptions for live data updates

### Negative
- **Vendor lock-in**: RLS policies use Supabase-specific functions (auth.uid())
- **Migration effort**: Moving to another provider requires rewriting RLS policies
- **Scaling limits**: Free tier has connection and storage limits
- **Regional availability**: Fewer regions than AWS or GCP

### Neutral
- **PostgreSQL version**: Running PostgreSQL 15 (standard version)
- **Network egress**: Charged for outbound data transfer on larger plans

## Implementation Notes

### Project Setup
1. Create Supabase project at https://supabase.com/dashboard
2. Note database credentials from Settings > Database
3. Configure environment variables

### Environment Variables
```bash
# .env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

# Supabase connection pooler (for Prisma/serverless)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres?pgbouncer=true"
```

### Prisma Configuration
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For migrations
}
```

**Important:** 
- Use `DATABASE_URL` with connection pooler (port 6543) for queries
- Use `DIRECT_URL` without pooler (port 5432) for migrations

### Connection Pooling
Supabase includes PgBouncer for connection pooling:
- Session mode: For migrations and schema changes (port 5432)
- Transaction mode: For application queries (port 6543)

```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Uses connection pooler
    },
  },
});
```

### Database Extensions
Enable extensions in Supabase Dashboard > Database > Extensions:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Optional: Vector similarity search (for AI features)
CREATE EXTENSION IF NOT EXISTS "vector";
```

### Row-Level Security Setup
```sql
-- Enable RLS on table
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Create policy using Supabase auth
CREATE POLICY "users_own_accounts" 
  ON accounts
  FOR ALL
  USING (auth.uid() = owner_id);

-- Complex policy example
CREATE POLICY "account_members_access" 
  ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = orders.account_id
        AND account_members.user_id = auth.uid()
    )
  );
```

### Backups and Recovery
Supabase provides:
- **Daily automated backups**: Retained for 7 days (free tier) to 30 days (pro tier)
- **Point-in-time recovery (PITR)**: Pro plan and above
- **Manual backups**: Via `pg_dump` or Supabase CLI

```bash
# Backup database via pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" > backup.sql

# Restore database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" < backup.sql
```

### Monitoring and Performance
Access in Supabase Dashboard:
- **Query Performance**: Slow query log, execution times
- **Database Usage**: Storage, connections, requests
- **API Logs**: RESTful API request logs
- **Realtime Logs**: Subscription activity

### Security Configuration
```sql
-- Revoke public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Grant only to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Enable SSL enforcement (already enabled by default)
-- All connections use SSL/TLS

-- Network: Configure IP allowlist if needed (Enterprise plan)
```

### Scaling Strategy
**Free Tier:**
- 500MB database storage
- 1GB file storage
- 50,000 monthly active users
- 500MB egress

**Pro Tier ($25/month):**
- 8GB database storage (can purchase more)
- 100GB file storage
- 100,000 monthly active users
- 50GB egress
- Point-in-time recovery
- Daily backups for 30 days

**Scaling Path:**
1. Start on free tier for development
2. Upgrade to Pro when approaching limits
3. Add compute for read replicas if needed
4. Consider dedicated infrastructure at large scale

### Database Migrations with Prisma
```bash
# Development: Create and apply migration
npx prisma migrate dev --name add_orders_table

# Production: Apply pending migrations
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

### Local Development
For local development, can use Docker:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tradeio_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tradeio_dev"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/tradeio_dev"
```

## Performance Considerations

### Indexing Strategy
Create indexes for:
- Foreign keys (for joins)
- Frequently filtered columns (status, created_at)
- Unique constraints (email, idempotency_key)

```sql
CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

### Query Optimization
- Use `EXPLAIN ANALYZE` to check query plans
- Monitor slow queries in Supabase dashboard
- Use Prisma's select to fetch only needed fields
- Implement cursor-based pagination for large datasets

### Connection Management
- Use connection pooler (port 6543) for serverless functions
- Use direct connection (port 5432) for long-running processes
- Monitor connection count in dashboard
- Implement connection limits in Prisma client

## Cost Estimation

**Development:**
- Free tier: $0/month
- Suitable for development and testing

**Production (small):**
- Pro tier: $25/month
- 8GB database, 100K MAU
- Suitable for MVP and early growth

**Production (medium):**
- Pro tier + compute: ~$100/month
- Additional storage and compute units
- Suitable for 500K+ MAU

## Related Decisions
- [ADR 0003: Database ORM](./0003-database-orm.md) - Prisma for database access
- [ADR 0004: Auth Provider](./0004-auth-provider.md) - Supabase Auth for authentication

## References
- [Supabase Database Documentation](https://supabase.com/docs/guides/database)
- [Supabase with Prisma](https://supabase.com/docs/guides/integrations/prisma)
- [Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Row-Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)

## Review Date
This decision should be reviewed in **12 months (December 2026)** or when:
- Database costs exceed 15% of total infrastructure budget
- Performance bottlenecks become frequent
- Need for multi-region deployment arises
- Alternative providers offer significantly better pricing or features
