# Database Migration Workflow

This document describes the database migration workflow for the Trade.io platform using Prisma.

## Overview

We use Prisma Migrate for managing database schema changes. Migrations are version-controlled SQL files that describe changes to the database schema.

## Initial Setup

The initial database schema has been created with the following tables:

- **users** - User accounts with authentication providers
- **accounts** - Trading accounts owned by users
- **orders** - Trading orders (market, limit, stop, etc.)
- **executions** - Order executions (fills)
- **positions** - Current positions for each account
- **ledger_entries** - Ledger for tracking cash and stock movements
- **instruments** - Tradeable instruments (stocks, ETFs, etc.)
- **audit_logs** - Audit trail for all state changes

## Migration Files

Migration files are stored in `prisma/migrations/` and include:

- `migration_lock.toml` - Lock file to prevent concurrent migrations
- `YYYYMMDDHHMMSS_migration_name/` - Directory for each migration
  - `migration.sql` - SQL statements to apply the migration

## Common Migration Commands

### Create a New Migration

When you modify `prisma/schema.prisma`, create a migration:

```bash
npx prisma migrate dev --name descriptive_migration_name
```

This will:
1. Generate SQL for your schema changes
2. Apply the migration to your local database
3. Regenerate Prisma Client

### Apply Migrations

To apply all pending migrations (e.g., after pulling changes):

```bash
npx prisma migrate deploy
```

### Reset Database

**⚠️ WARNING: This deletes all data!**

```bash
npx prisma migrate reset
```

This will:
1. Drop all tables
2. Apply all migrations from scratch
3. Run seed data (if configured)

### Check Migration Status

```bash
npx prisma migrate status
```

### Generate Prisma Client

After pulling new migrations, regenerate the client:

```bash
npx prisma generate
```

## Development Workflow

### Making Schema Changes

1. **Edit the schema**: Modify `prisma/schema.prisma`
   
2. **Create migration**:
   ```bash
   npx prisma migrate dev --name your_change_description
   ```

3. **Review the generated SQL**: Check `prisma/migrations/[timestamp]_your_change_description/migration.sql`

4. **Test the migration**: Run integration tests
   ```bash
   npm run test:integration
   ```

5. **Commit the migration**: Add both schema.prisma and the migration directory
   ```bash
   git add prisma/schema.prisma prisma/migrations/
   git commit -m "feat(db): add [description] - Refs #XXXX"
   ```

### Pulling Schema Changes

When another developer creates a migration:

1. **Pull the changes**:
   ```bash
   git pull
   ```

2. **Apply migrations**:
   ```bash
   npx prisma migrate deploy
   ```
   
3. **Regenerate client** (if needed):
   ```bash
   npx prisma generate
   ```

## Production Deployment

### Pre-deployment Checklist

- [ ] Migration tested locally
- [ ] Integration tests passing
- [ ] Migration reviewed for performance impact
- [ ] Backup strategy in place
- [ ] Rollback plan documented

### Deployment Steps

1. **Backup the database**
   ```bash
   # Use your hosting provider's backup tool
   # For Supabase: Done automatically
   ```

2. **Apply migrations**
   ```bash
   npx prisma migrate deploy
   ```

3. **Verify schema**
   ```bash
   npx prisma db execute --stdin <<EOF
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
   EOF
   ```

## Migration Best Practices

### DO ✅

- **Make small, incremental changes**: One logical change per migration
- **Test migrations locally**: Always test before committing
- **Use descriptive names**: `add_user_role_column` not `update_users`
- **Review generated SQL**: Ensure it matches your intent
- **Add indexes for foreign keys**: Prisma adds them automatically
- **Use transactions**: Prisma wraps migrations in transactions by default
- **Document breaking changes**: Add comments in the migration file

### DON'T ❌

- **Don't edit applied migrations**: Create a new migration instead
- **Don't use `migrate reset` in production**: You'll lose all data!
- **Don't skip migrations**: Apply them in order
- **Don't bypass Prisma**: Always use Prisma Migrate, not raw SQL
- **Don't share migration files before committing**: Merge conflicts are painful

## Common Issues

### Migration Failed Halfway

If a migration fails partway through:

```bash
# Mark the migration as rolled back
npx prisma migrate resolve --rolled-back [migration_name]

# Fix the schema
# Create a new migration
npx prisma migrate dev --name fix_migration_name
```

### Schema Drift Detected

If your database schema doesn't match your migrations:

```bash
# See what's different
npx prisma db pull

# Option 1: Reset (development only!)
npx prisma migrate reset

# Option 2: Create baseline migration (production)
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > fix.sql
```

### Merge Conflicts in Migrations

If two developers create migrations at the same time:

```bash
# Rebase to get latest migrations
git pull --rebase

# Reset your migration
npx prisma migrate reset

# Reapply your schema change
npx prisma migrate dev --name your_change
```

## Rollback Strategy

Prisma doesn't support automatic rollbacks. To roll back a change:

### Option 1: Create a Reversal Migration

Create a new migration that undoes the change:

```bash
# Manually edit schema.prisma to undo changes
npx prisma migrate dev --name rollback_previous_change
```

### Option 2: Database Restore

Restore from backup:

```bash
# Use your hosting provider's restore tool
# For Supabase: Use Point-in-Time Recovery (PITR)
```

## Testing Migrations

### Local Testing

```bash
# Start fresh database
docker compose down -v
docker compose up -d

# Apply migrations
npx prisma migrate deploy

# Run integration tests
npm run test:integration
```

### Integration Tests

We test migrations with comprehensive integration tests in `tests/integration/db-migration.test.ts`:

- Table creation and constraints
- Unique constraints
- Foreign key relationships
- Cascade deletes
- Default values
- Indexes
- Data types

## Schema Version Control

- **Schema file**: `prisma/schema.prisma` is the source of truth
- **Migration files**: `prisma/migrations/` are generated from the schema
- **Both are version controlled**: Always commit both together
- **Prisma Client**: Generated code, not version controlled (in `.gitignore`)

## Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/database/troubleshooting-orm)

## Checklist for Issue #0009

- [x] Initial migration created (`20251212194536_initial_schema`)
- [x] All 8 tables created (users, accounts, orders, executions, positions, ledger_entries, instruments, audit_logs)
- [x] All indexes created (21 indexes total)
- [x] All foreign key constraints created (6 foreign keys)
- [x] All unique constraints created (6 unique constraints)
- [x] Migration applied to local database
- [x] Integration tests created and passing (22 tests)
- [x] Documentation created (this file)
- [x] Migration workflow documented
