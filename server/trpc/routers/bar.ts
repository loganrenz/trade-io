/**
 * Bar Router
 * OHLCV bar data endpoints for charting
 */
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../lib/db';
import { timeframeSchema } from '../../lib/schemas';

/**
 * Get bars schema
 */
const getBarsSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  timeframe: timeframeSchema,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  limit: z.number().int().positive().max(1000).default(100),
});

export const barRouter = router({
  /**
   * Get OHLCV bars for a symbol
   */
  get: publicProcedure.input(getBarsSchema).query(async ({ input }) => {
    const where: {
      symbol: string;
      timeframe: string;
      timestamp?: { gte?: Date; lte?: Date };
    } = {
      symbol: input.symbol,
      timeframe: input.timeframe,
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

    const bars = await db.bar.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: input.limit,
      select: {
        id: true,
        symbol: true,
        timeframe: true,
        timestamp: true,
        open: true,
        high: true,
        low: true,
        close: true,
        volume: true,
        vwap: true,
        trades: true,
      },
    });

    return bars;
  }),

  /**
   * Get latest bar for a symbol and timeframe
   */
  latest: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(10).toUpperCase(),
        timeframe: timeframeSchema,
      })
    )
    .query(async ({ input }) => {
      const bar = await db.bar.findFirst({
        where: {
          symbol: input.symbol,
          timeframe: input.timeframe,
        },
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          id: true,
          symbol: true,
          timeframe: true,
          timestamp: true,
          open: true,
          high: true,
          low: true,
          close: true,
          volume: true,
          vwap: true,
        },
      });

      return bar;
    }),
});
