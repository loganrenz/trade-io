-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "eventType" VARCHAR(20) NOT NULL,
    "oldStatus" VARCHAR(20),
    "newStatus" VARCHAR(20) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "accountType" VARCHAR(20) NOT NULL,
    "accountName" VARCHAR(100) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "bid" DECIMAL(20,8),
    "ask" DECIMAL(20,8),
    "last" DECIMAL(20,8),
    "volume" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bars" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "volume" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_sessions" (
    "id" UUID NOT NULL,
    "exchange" VARCHAR(20) NOT NULL,
    "sessionType" VARCHAR(20) NOT NULL,
    "openTime" TIME(6) NOT NULL,
    "closeTime" TIME(6) NOT NULL,
    "daysOfWeek" INTEGER[],
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_limits" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "limitType" VARCHAR(50) NOT NULL,
    "symbol" VARCHAR(10),
    "limitValue" DECIMAL(18,2) NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_restrictions" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "accountId" UUID,
    "restriction" VARCHAR(20) NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "symbol_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_events_eventType_idx" ON "order_events"("eventType");

-- CreateIndex
CREATE INDEX "ledger_accounts_accountId_idx" ON "ledger_accounts"("accountId");

-- CreateIndex
CREATE INDEX "ledger_accounts_accountType_idx" ON "ledger_accounts"("accountType");

-- CreateIndex
CREATE INDEX "quotes_instrumentId_timestamp_idx" ON "quotes"("instrumentId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "quotes_timestamp_idx" ON "quotes"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "bars_instrumentId_timeframe_timestamp_idx" ON "bars"("instrumentId", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bars_instrumentId_timeframe_timestamp_key" ON "bars"("instrumentId", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "trading_sessions_exchange_idx" ON "trading_sessions"("exchange");

-- CreateIndex
CREATE INDEX "risk_limits_accountId_idx" ON "risk_limits"("accountId");

-- CreateIndex
CREATE INDEX "risk_limits_limitType_idx" ON "risk_limits"("limitType");

-- CreateIndex
CREATE INDEX "risk_limits_symbol_idx" ON "risk_limits"("symbol");

-- CreateIndex
CREATE INDEX "symbol_restrictions_symbol_idx" ON "symbol_restrictions"("symbol");

-- CreateIndex
CREATE INDEX "symbol_restrictions_accountId_idx" ON "symbol_restrictions"("accountId");

-- CreateIndex
CREATE INDEX "symbol_restrictions_isActive_idx" ON "symbol_restrictions"("isActive");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bars" ADD CONSTRAINT "bars_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
