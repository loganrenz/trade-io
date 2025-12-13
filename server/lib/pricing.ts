/**
 * Pricing Service
 * Current market pricing and calculations
 */
import { db } from './db';
import { logger } from './logger';

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(symbol: string): Promise<number | null> {
  try {
    const quote = await db.quote.findFirst({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
      select: { last: true },
    });

    return quote ? Number(quote.last) : null;
  } catch (error) {
    logger.error({ error, symbol }, 'Failed to get current price');
    return null;
  }
}

/**
 * Get bid/ask spread for a symbol
 */
export async function getSpread(
  symbol: string
): Promise<{ bid: number; ask: number; spread: number } | null> {
  try {
    const quote = await db.quote.findFirst({
      where: { symbol },
      orderBy: { timestamp: 'desc' },
      select: { bid: true, ask: true },
    });

    if (!quote || !quote.bid || !quote.ask) {
      return null;
    }

    const bid = Number(quote.bid);
    const ask = Number(quote.ask);

    return {
      bid,
      ask,
      spread: ask - bid,
    };
  } catch (error) {
    logger.error({ error, symbol }, 'Failed to get spread');
    return null;
  }
}

/**
 * Get mid price (average of bid and ask)
 */
export async function getMidPrice(symbol: string): Promise<number | null> {
  const spread = await getSpread(symbol);
  if (!spread) {
    return null;
  }

  return (spread.bid + spread.ask) / 2;
}

/**
 * Calculate position value
 */
export async function calculatePositionValue(
  symbol: string,
  quantity: number
): Promise<number | null> {
  const price = await getCurrentPrice(symbol);
  if (!price) {
    return null;
  }

  return price * Math.abs(quantity);
}

/**
 * Calculate unrealized PnL for a position
 */
export async function calculateUnrealizedPnL(
  symbol: string,
  quantity: number,
  averageCost: number
): Promise<number | null> {
  const currentPrice = await getCurrentPrice(symbol);
  if (!currentPrice) {
    return null;
  }

  const currentValue = currentPrice * quantity;
  const costBasis = averageCost * quantity;

  return currentValue - costBasis;
}

/**
 * Get current prices for multiple symbols
 */
export async function getBatchPrices(symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();

  try {
    const quotes = await db.quote.findMany({
      where: {
        symbol: { in: symbols },
      },
      select: {
        symbol: true,
        last: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
      distinct: ['symbol'],
    });

    for (const quote of quotes) {
      prices.set(quote.symbol, Number(quote.last));
    }
  } catch (error) {
    logger.error({ error, symbols }, 'Failed to get batch prices');
  }

  return prices;
}

/**
 * Check if market is open for trading
 */
export async function isMarketOpen(exchange: string): Promise<boolean> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Basic check: weekdays only (1-5 is Mon-Fri)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Check trading session
    const session = await db.tradingSession.findFirst({
      where: {
        exchange,
        sessionType: 'REGULAR',
      },
    });

    if (!session) {
      return false;
    }

    // TODO: Implement proper time-of-day check
    // For now, return true if it's a weekday
    return true;
  } catch (error) {
    logger.error({ error, exchange }, 'Failed to check market hours');
    return false;
  }
}
