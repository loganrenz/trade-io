/**
 * Bar Ingestion Service
 * Fetches and stores OHLCV bar data
 */
import { db } from './db';
import { logger } from './logger';
import { marketDataProvider } from './market-data-provider';

/**
 * Ingest bars for a symbol
 */
export async function ingestBars(
  symbol: string,
  timeframe: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    logger.info({ symbol, timeframe, startDate, endDate }, 'Ingesting bar data');

    const bars = await marketDataProvider.getBars(symbol, timeframe, startDate, endDate);

    // Find or create instrument
    let instrument = await db.instrument.findFirst({
      where: { symbol },
    });

    if (!instrument) {
      logger.debug({ symbol }, 'Creating instrument for new symbol');
      instrument = await db.instrument.create({
        data: {
          symbol,
          name: symbol,
          type: 'STOCK',
          exchange: 'UNKNOWN',
          isTradeable: true,
          isActive: true,
        },
      });
    }

    // Batch insert bars
    if (bars.length > 0) {
      await db.bar.createMany({
        data: bars.map((b) => ({
          instrumentId: instrument!.id,
          symbol: b.symbol,
          timeframe: b.timeframe,
          timestamp: b.timestamp,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: BigInt(b.volume),
          vwap: b.vwap,
          trades: b.trades,
        })),
        skipDuplicates: true,
      });
    }

    logger.info({ symbol, timeframe, count: bars.length }, 'Bar data ingested');
  } catch (error) {
    logger.error({ error, symbol, timeframe }, 'Failed to ingest bars');
    throw error;
  }
}

/**
 * Ingest bars for multiple symbols
 */
export async function ingestBarsBatch(
  symbols: string[],
  timeframe: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  logger.info({ count: symbols.length, timeframe }, 'Ingesting bars batch');

  const results = await Promise.allSettled(
    symbols.map((s) => ingestBars(s, timeframe, startDate, endDate))
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  const succeeded = results.length - failed;

  logger.info({ succeeded, failed, total: symbols.length }, 'Bars batch ingestion complete');
}

/**
 * Backfill historical bars for a symbol
 */
export async function backfillBars(
  symbol: string,
  timeframes: string[],
  startDate: Date,
  endDate: Date
): Promise<void> {
  logger.info({ symbol, timeframes, startDate, endDate }, 'Backfilling bars');

  for (const timeframe of timeframes) {
    await ingestBars(symbol, timeframe, startDate, endDate);
  }

  logger.info({ symbol, timeframes }, 'Bar backfill complete');
}
