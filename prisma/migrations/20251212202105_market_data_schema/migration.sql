-- AlterTable
ALTER TABLE "instruments" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "industry" VARCHAR(50),
ADD COLUMN     "marketCap" DECIMAL(20,2),
ADD COLUMN     "sector" VARCHAR(50);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "bid" DECIMAL(18,4),
    "ask" DECIMAL(18,4),
    "bidSize" INTEGER,
    "askSize" INTEGER,
    "last" DECIMAL(18,4) NOT NULL,
    "lastSize" INTEGER,
    "volume" BIGINT NOT NULL DEFAULT 0,
    "open" DECIMAL(18,4),
    "high" DECIMAL(18,4),
    "low" DECIMAL(18,4),
    "close" DECIMAL(18,4),
    "change" DECIMAL(18,4),
    "changePercent" DECIMAL(8,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bars" (
    "id" UUID NOT NULL,
    "instrumentId" UUID NOT NULL,
    "symbol" VARCHAR(10) NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(18,4) NOT NULL,
    "high" DECIMAL(18,4) NOT NULL,
    "low" DECIMAL(18,4) NOT NULL,
    "close" DECIMAL(18,4) NOT NULL,
    "volume" BIGINT NOT NULL,
    "vwap" DECIMAL(18,4),
    "trades" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_sessions" (
    "id" UUID NOT NULL,
    "instrumentId" UUID,
    "exchange" VARCHAR(10) NOT NULL,
    "date" DATE NOT NULL,
    "sessionType" VARCHAR(20) NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "isTradingDay" BOOLEAN NOT NULL DEFAULT true,
    "holidayName" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_symbol_timestamp_idx" ON "quotes"("symbol", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "quotes_instrumentId_timestamp_idx" ON "quotes"("instrumentId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "quotes_timestamp_idx" ON "quotes"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "bars_symbol_timeframe_timestamp_idx" ON "bars"("symbol", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "bars_instrumentId_timeframe_timestamp_idx" ON "bars"("instrumentId", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "bars_timestamp_idx" ON "bars"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bars_symbol_timeframe_timestamp_key" ON "bars"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "trading_sessions_exchange_date_idx" ON "trading_sessions"("exchange", "date");

-- CreateIndex
CREATE INDEX "trading_sessions_date_idx" ON "trading_sessions"("date");

-- CreateIndex
CREATE INDEX "trading_sessions_isTradingDay_idx" ON "trading_sessions"("isTradingDay");

-- CreateIndex
CREATE UNIQUE INDEX "trading_sessions_exchange_date_sessionType_key" ON "trading_sessions"("exchange", "date", "sessionType");

-- CreateIndex
CREATE INDEX "instruments_exchange_idx" ON "instruments"("exchange");

-- CreateIndex
CREATE INDEX "instruments_type_idx" ON "instruments"("type");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bars" ADD CONSTRAINT "bars_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_sessions" ADD CONSTRAINT "trading_sessions_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
