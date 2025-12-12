# Data Model

## Overview

This document defines the complete database schema for Trade.io. The schema is designed for:

- **Data Integrity**: Foreign keys, constraints, proper types
- **Auditability**: Timestamps, soft deletes, immutable audit log
- **Performance**: Appropriate indexes for common queries
- **Security**: RLS policies (if Supabase) or application-level checks

## Schema Conventions

### Naming

- **Tables**: `snake_case`, plural nouns (`users`, `orders`)
- **Columns**: `snake_case` (`created_at`, `account_id`)
- **Primary Keys**: `id` (UUID)
- **Foreign Keys**: `{table}_id` (`user_id`, `account_id`)
- **Timestamps**: `created_at`, `updated_at`, `deleted_at`

### Common Columns

Every table includes:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Many tables include:

- `deleted_at TIMESTAMPTZ` (for soft deletes)

## Entity Relationship Diagram

```
users ──┬─── account_members ──── accounts
        │                            │
        └─── sessions                ├─── orders ──── order_events
                                     │       │
                                     │       └─── executions
                                     │              │
                                     ├─── positions │
                                     │              │
                                     └─── ledger_entries
                                            │
instruments ─────────────────────────┘     │
    │                                      │
    ├─── quotes                            │
    ├─── bars                              │
    └─── trading_sessions                  │
                                           │
audit_log ─────────────────────────────────┘
risk_limits
symbol_restrictions
```

## Core Entities

### Users

User accounts and authentication.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50) NOT NULL, -- 'supabase', 'clerk', 'google', 'email'
  auth_provider_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_auth_provider ON users(auth_provider, auth_provider_id);
```

### Accounts

Trading accounts (cash accounts). Users can have multiple accounts and accounts can have multiple users (account members).

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'CASH', -- 'CASH', 'MARGIN' (future)
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'CLOSED'
  initial_balance DECIMAL(20, 2) NOT NULL DEFAULT 100000.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CHECK (account_type IN ('CASH', 'MARGIN')),
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  CHECK (initial_balance >= 0)
);

CREATE INDEX idx_accounts_status ON accounts(status) WHERE deleted_at IS NULL;
```

### Account Members

Links users to accounts with roles.

```sql
CREATE TABLE account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'TRADER', 'VIEWER'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, user_id),
  CHECK (role IN ('OWNER', 'ADMIN', 'TRADER', 'VIEWER'))
);

CREATE INDEX idx_account_members_user_id ON account_members(user_id);
CREATE INDEX idx_account_members_account_id ON account_members(account_id);
```

**Roles:**

- **OWNER**: Full control, can delete account
- **ADMIN**: Manage members, configure settings
- **TRADER**: Place/cancel orders, view portfolio
- **VIEWER**: Read-only access

### Sessions

User sessions (if using custom auth).

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of session token
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Market Data Entities

### Instruments

Tradeable symbols.

```sql
CREATE TABLE instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(20) NOT NULL DEFAULT 'STOCK', -- 'STOCK', 'ETF', 'OPTION' (future)
  exchange VARCHAR(20) NOT NULL, -- 'NYSE', 'NASDAQ', 'AMEX'
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_tradeable BOOLEAN NOT NULL DEFAULT TRUE,
  is_fractional BOOLEAN NOT NULL DEFAULT FALSE,
  min_order_size DECIMAL(20, 8) NOT NULL DEFAULT 1,
  metadata JSONB, -- Additional symbol info
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (asset_type IN ('STOCK', 'ETF', 'OPTION', 'CRYPTO')),
  CHECK (min_order_size > 0)
);

CREATE INDEX idx_instruments_symbol ON instruments(symbol);
CREATE INDEX idx_instruments_tradeable ON instruments(is_tradeable);
```

### Quotes

Real-time price quotes.

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  timestamp TIMESTAMPTZ NOT NULL,
  bid DECIMAL(20, 8),
  ask DECIMAL(20, 8),
  last DECIMAL(20, 8),
  volume BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (bid >= 0),
  CHECK (ask >= 0),
  CHECK (last >= 0),
  CHECK (volume >= 0)
);

CREATE INDEX idx_quotes_instrument_timestamp ON quotes(instrument_id, timestamp DESC);
CREATE INDEX idx_quotes_timestamp ON quotes(timestamp DESC);
```

**Retention**: Keep only recent quotes (e.g., 7 days). Archive older data.

### Bars

Historical OHLCV data.

```sql
CREATE TABLE bars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '1h', '1d'
  timestamp TIMESTAMPTZ NOT NULL,
  open DECIMAL(20, 8) NOT NULL,
  high DECIMAL(20, 8) NOT NULL,
  low DECIMAL(20, 8) NOT NULL,
  close DECIMAL(20, 8) NOT NULL,
  volume BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(instrument_id, timeframe, timestamp),
  CHECK (high >= low),
  CHECK (high >= open),
  CHECK (high >= close),
  CHECK (low <= open),
  CHECK (low <= close),
  CHECK (volume >= 0)
);

CREATE INDEX idx_bars_instrument_timeframe_timestamp ON bars(instrument_id, timeframe, timestamp DESC);
```

### Trading Sessions

Market hours and sessions.

```sql
CREATE TABLE trading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange VARCHAR(20) NOT NULL,
  session_type VARCHAR(20) NOT NULL, -- 'REGULAR', 'PRE_MARKET', 'AFTER_HOURS'
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL, -- [1,2,3,4,5] for Mon-Fri
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trading_sessions_exchange ON trading_sessions(exchange);
```

## Trading Entities

### Orders

Trade orders.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  side VARCHAR(4) NOT NULL, -- 'BUY', 'SELL'
  order_type VARCHAR(20) NOT NULL, -- 'MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'
  time_in_force VARCHAR(10) NOT NULL DEFAULT 'DAY', -- 'DAY', 'GTC', 'IOC', 'FOK'
  quantity DECIMAL(20, 8) NOT NULL,
  filled_quantity DECIMAL(20, 8) NOT NULL DEFAULT 0,
  limit_price DECIMAL(20, 8),
  stop_price DECIMAL(20, 8),
  average_fill_price DECIMAL(20, 8),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'
  rejection_reason TEXT,
  idempotency_key VARCHAR(255) UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  submitted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (side IN ('BUY', 'SELL')),
  CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT')),
  CHECK (time_in_force IN ('DAY', 'GTC', 'IOC', 'FOK')),
  CHECK (status IN ('PENDING', 'ACCEPTED', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED')),
  CHECK (quantity > 0),
  CHECK (filled_quantity >= 0),
  CHECK (filled_quantity <= quantity),
  CHECK ((order_type = 'LIMIT' OR order_type = 'STOP_LIMIT') = (limit_price IS NOT NULL)),
  CHECK ((order_type = 'STOP' OR order_type = 'STOP_LIMIT') = (stop_price IS NOT NULL))
);

CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_idempotency_key ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_account_status ON orders(account_id, status);
```

### Order Events

State changes for orders (event sourcing pattern).

```sql
CREATE TABLE order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  event_type VARCHAR(20) NOT NULL, -- 'CREATED', 'ACCEPTED', 'PARTIAL_FILL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (event_type IN ('CREATED', 'ACCEPTED', 'PARTIAL_FILL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'))
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id, created_at);
```

### Executions

Order fills (trades).

```sql
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  side VARCHAR(4) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  total_value DECIMAL(20, 2) NOT NULL,
  commission DECIMAL(20, 2) NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (side IN ('BUY', 'SELL')),
  CHECK (quantity > 0),
  CHECK (price > 0),
  CHECK (total_value > 0),
  CHECK (commission >= 0)
);

CREATE INDEX idx_executions_order_id ON executions(order_id);
CREATE INDEX idx_executions_account_id ON executions(account_id, executed_at DESC);
CREATE INDEX idx_executions_instrument_id ON executions(instrument_id);
```

### Positions

Current holdings (derived from executions).

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  quantity DECIMAL(20, 8) NOT NULL,
  average_cost DECIMAL(20, 8) NOT NULL,
  realized_pnl DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, instrument_id),
  CHECK (quantity != 0) -- No zero positions
);

CREATE INDEX idx_positions_account_id ON positions(account_id);
CREATE INDEX idx_positions_instrument_id ON positions(instrument_id);
```

**Note**: Positions are derived/cached. Recalculated from executions on each trade.

## Financial Entities

### Ledger Accounts

Double-entry ledger account types.

```sql
CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  account_type VARCHAR(20) NOT NULL, -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
  subtype VARCHAR(50) NOT NULL, -- 'CASH', 'SECURITIES', 'COMMISSION', etc.
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, subtype),
  CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'))
);

CREATE INDEX idx_ledger_accounts_account_id ON ledger_accounts(account_id);
```

**Common ledger accounts per trading account:**

- **ASSET:CASH** - Cash balance
- **ASSET:SECURITIES** - Value of holdings
- **EQUITY:INITIAL** - Initial deposit
- **EXPENSE:COMMISSION** - Trading fees

### Ledger Entries

Double-entry bookkeeping transactions.

```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  transaction_id UUID NOT NULL, -- Groups debit/credit pairs
  entry_type VARCHAR(10) NOT NULL, -- 'DEBIT', 'CREDIT'
  amount DECIMAL(20, 2) NOT NULL,
  balance_after DECIMAL(20, 2) NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50), -- 'EXECUTION', 'DEPOSIT', 'WITHDRAWAL', 'DIVIDEND'
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (entry_type IN ('DEBIT', 'CREDIT')),
  CHECK (amount > 0)
);

CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id, created_at DESC);
CREATE INDEX idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_type, reference_id);
```

**Double-entry invariant**: For each `transaction_id`, sum of DEBITs = sum of CREDITs.

## Risk & Compliance Entities

### Risk Limits

Per-account or per-user risk limits.

```sql
CREATE TABLE risk_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  user_id UUID REFERENCES users(id),
  limit_type VARCHAR(50) NOT NULL, -- 'MAX_POSITION_SIZE', 'MAX_ORDER_VALUE', 'MAX_CONCENTRATION'
  instrument_id UUID REFERENCES instruments(id), -- NULL for account-level limits
  limit_value DECIMAL(20, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK ((account_id IS NOT NULL) OR (user_id IS NOT NULL)),
  CHECK (limit_value > 0)
);

CREATE INDEX idx_risk_limits_account_id ON risk_limits(account_id);
CREATE INDEX idx_risk_limits_user_id ON risk_limits(user_id);
```

### Symbol Restrictions

Halted or restricted symbols.

```sql
CREATE TABLE symbol_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID NOT NULL REFERENCES instruments(id),
  restriction_type VARCHAR(20) NOT NULL, -- 'HALT', 'CLOSE_ONLY', 'REDUCED'
  reason TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (restriction_type IN ('HALT', 'CLOSE_ONLY', 'REDUCED')),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_symbol_restrictions_instrument_id ON symbol_restrictions(instrument_id);
CREATE INDEX idx_symbol_restrictions_active ON symbol_restrictions(starts_at, ends_at);
```

### Audit Log

Immutable append-only audit trail.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id), -- NULL for system actions
  action VARCHAR(100) NOT NULL, -- 'ORDER_PLACED', 'ORDER_CANCELLED', 'ACCOUNT_CREATED', etc.
  resource_type VARCHAR(50) NOT NULL, -- 'order', 'account', 'user', etc.
  resource_id UUID,
  metadata JSONB,
  request_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor_id ON audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_request_id ON audit_log(request_id);
```

**Immutable**: Never UPDATE or DELETE audit log entries.

## Indexes Summary

All foreign keys have indexes. Additional indexes for:

- Common query patterns (account orders, user positions)
- Timestamp-based queries (order history, audit log)
- Unique constraints (email, idempotency keys)
- Partial indexes (non-deleted, active)

## Row-Level Security (If using Supabase)

Example RLS policies:

```sql
-- Users can only see their own user record
CREATE POLICY "users_own_record" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can see accounts they're members of
CREATE POLICY "users_own_accounts" ON accounts
  FOR SELECT
  USING (id IN (
    SELECT account_id FROM account_members
    WHERE user_id = auth.uid()
  ));

-- Users can see orders for their accounts
CREATE POLICY "users_own_orders" ON orders
  FOR SELECT
  USING (account_id IN (
    SELECT account_id FROM account_members
    WHERE user_id = auth.uid()
  ));
```

## Migrations Strategy

- Use timestamped migration files: `YYYYMMDDHHMMSS_description.sql`
- Never edit existing migrations after merge
- Include both `up` and `down` migrations
- Test rollbacks
- Separate schema and data migrations

## Next Steps

See individual phase issues for:

1. Creating initial migration files
2. Setting up ORM (Prisma/Drizzle)
3. Implementing RLS policies (if Supabase)
4. Adding seed data for development

---

**Document Status**: Complete schema definition. Will be implemented in Phase 1 issues.
