/**
 * Trading Hours Validation Service
 * Check if markets are open for trading
 */
import { db } from './db';
import { logger } from './logger';

export interface TradingHours {
  isOpen: boolean;
  session?: {
    openTime: Date;
    closeTime: Date;
    sessionType: string;
  };
  nextOpen?: Date;
  exchange: string;
}

/**
 * Check if a specific exchange is currently open for trading
 */
export async function isExchangeOpen(exchange: string): Promise<boolean> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Quick check: weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }

    // Get regular trading session for the exchange
    const session = await db.tradingSession.findFirst({
      where: {
        exchange,
        sessionType: 'REGULAR',
      },
    });

    if (!session) {
      logger.warn({ exchange }, 'No trading session found for exchange');
      return false;
    }

    // TODO: Implement actual time-of-day validation
    // For now, assume markets are open on weekdays
    return true;
  } catch (error) {
    logger.error({ error, exchange }, 'Failed to check exchange hours');
    return false;
  }
}

/**
 * Get detailed trading hours information for an exchange
 */
export async function getTradingHours(exchange: string): Promise<TradingHours> {
  const isOpen = await isExchangeOpen(exchange);

  const session = await db.tradingSession.findFirst({
    where: {
      exchange,
      sessionType: 'REGULAR',
    },
  });

  return {
    isOpen,
    exchange,
    session: session
      ? {
          openTime: session.openTime,
          closeTime: session.closeTime,
          sessionType: session.sessionType,
        }
      : undefined,
  };
}

/**
 * Check if trading is allowed for a specific instrument
 */
export async function canTradeInstrument(symbol: string): Promise<boolean> {
  try {
    const instrument = await db.instrument.findFirst({
      where: {
        symbol,
        isTradeable: true,
        isActive: true,
      },
    });

    if (!instrument) {
      return false;
    }

    // Check if exchange is open
    return await isExchangeOpen(instrument.exchange);
  } catch (error) {
    logger.error({ error, symbol }, 'Failed to check if instrument tradeable');
    return false;
  }
}

/**
 * Validate trading hours for an order
 */
export async function validateTradingHours(
  symbol: string,
  exchange: string
): Promise<{ allowed: boolean; reason?: string }> {
  const instrument = await db.instrument.findFirst({
    where: { symbol },
  });

  if (!instrument) {
    return {
      allowed: false,
      reason: 'Instrument not found',
    };
  }

  if (!instrument.isTradeable) {
    return {
      allowed: false,
      reason: 'Instrument is not tradeable',
    };
  }

  if (!instrument.isActive) {
    return {
      allowed: false,
      reason: 'Instrument is not active',
    };
  }

  const isOpen = await isExchangeOpen(exchange);

  if (!isOpen) {
    return {
      allowed: false,
      reason: 'Market is closed',
    };
  }

  return { allowed: true };
}

/**
 * Get next market open time
 */
export async function getNextMarketOpen(_exchange: string): Promise<Date | null> {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // If it's Friday after close, Saturday, or Sunday, next open is Monday
  if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
    const daysUntilMonday = dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 30, 0, 0); // Assume 9:30 AM open
    return nextMonday;
  }

  // For weekdays, if before open, return today's open time
  // If after close, return tomorrow's open time
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 30, 0, 0);
  return tomorrow;
}
