/**
 * Quote Router
 * Real-time and historical quote endpoints
 */
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../lib/db';

/**
 * Get latest quote schema
 */
const getQuoteSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
});

/**
 * Get quote history schema
 */
const getQuoteHistorySchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
});

export const quoteRouter = router({
  /**
   * Get latest quote for a symbol
   */
  latest: publicProcedure.input(getQuoteSchema).query(async ({ input }) => {
    const quote = await db.quote.findFirst({
      where: {
        symbol: input.symbol,
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        id: true,
        symbol: true,
        timestamp: true,
        bid: true,
        ask: true,
        bidSize: true,
        askSize: true,
        last: true,
        lastSize: true,
        volume: true,
        open: true,
        high: true,
        low: true,
        close: true,
        change: true,
        changePercent: true,
      },
    });

    return quote;
  }),

  /**
   * Get quote history for a symbol
   */
  history: publicProcedure.input(getQuoteHistorySchema).query(async ({ input }) => {
    const where: {
      symbol: string;
      timestamp?: { gte?: Date; lte?: Date };
    } = {
      symbol: input.symbol,
    };

    if (input.startDate || input.endDate) {
      where.timestamp = {};
      if (input.startDate) {
        where.timestamp.gte = input.startDate;
      }
      if (input.endDate) {
        where.timestamp.lte = input.endDate;
      }
    }

    const quotes = await db.quote.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: input.limit,
      select: {
        id: true,
        symbol: true,
        timestamp: true,
        last: true,
        volume: true,
        high: true,
        low: true,
      },
    });

    return quotes;
  }),

  /**
   * Get latest quotes for multiple symbols
   */
  batch: publicProcedure
    .input(
      z.object({
        symbols: z.array(z.string().min(1).max(10).toUpperCase()).max(50),
      })
    )
    .query(async ({ input }) => {
      const quotes = await Promise.all(
        input.symbols.map(async (symbol) => {
          const quote = await db.quote.findFirst({
            where: { symbol },
            orderBy: { timestamp: 'desc' },
            select: {
              symbol: true,
              timestamp: true,
              last: true,
              bid: true,
              ask: true,
              volume: true,
              change: true,
              changePercent: true,
            },
          });
          return quote;
        })
      );

      return quotes.filter((q) => q !== null);
    }),
});
