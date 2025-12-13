/**
 * Quote Ingestion Service
 * Fetches and stores market quotes
 */
import { db } from './db';
import { logger } from './logger';
import { marketDataProvider } from './market-data-provider';

/**
 * Ingest latest quote for a symbol
 */
export async function ingestQuote(symbol: string): Promise<void> {
  try {
    const quote = await marketDataProvider.getQuote(symbol);

    if (!quote) {
      logger.warn({ symbol }, 'No quote data received');
      return;
    }

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

    // Store quote
    await db.quote.create({
      data: {
        instrumentId: instrument.id,
        symbol: quote.symbol,
        timestamp: quote.timestamp,
        bid: quote.bid,
        ask: quote.ask,
        last: quote.last,
        volume: quote.volume ? BigInt(quote.volume) : null,
        high: quote.high,
        low: quote.low,
        open: quote.open,
        close: quote.close,
      },
    });

    logger.debug({ symbol, timestamp: quote.timestamp }, 'Quote ingested');
  } catch (error) {
    logger.error({ error, symbol }, 'Failed to ingest quote');
    throw error;
  }
}

/**
 * Ingest quotes for multiple symbols
 */
export async function ingestQuoteBatch(symbols: string[]): Promise<void> {
  logger.info({ count: symbols.length }, 'Ingesting quote batch');

  const results = await Promise.allSettled(symbols.map((s) => ingestQuote(s)));

  const failed = results.filter((r) => r.status === 'rejected').length;
  const succeeded = results.length - failed;

  logger.info({ succeeded, failed, total: symbols.length }, 'Quote batch ingestion complete');
}

/**
 * Ingest historical quotes for a symbol
 */
export async function ingestQuoteHistory(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    logger.info({ symbol, startDate, endDate }, 'Ingesting quote history');

    const quotes = await marketDataProvider.getQuoteHistory(symbol, startDate, endDate);

    // Find or create instrument
    let instrument = await db.instrument.findFirst({
      where: { symbol },
    });

    if (!instrument) {
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

    // Batch insert quotes
    if (quotes.length > 0) {
      await db.quote.createMany({
        data: quotes.map((q) => ({
          instrumentId: instrument!.id,
          symbol: q.symbol,
          timestamp: q.timestamp,
          bid: q.bid,
          ask: q.ask,
          last: q.last,
          volume: q.volume ? BigInt(q.volume) : null,
          high: q.high,
          low: q.low,
          open: q.open,
          close: q.close,
        })),
        skipDuplicates: true,
      });
    }

    logger.info({ symbol, count: quotes.length }, 'Quote history ingested');
  } catch (error) {
    logger.error({ error, symbol }, 'Failed to ingest quote history');
    throw error;
  }
}
