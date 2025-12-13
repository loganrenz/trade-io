/**
 * Instrument Router
 * Instrument search and lookup endpoints
 */
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../lib/db';
import { instrumentSearchSchema, instrumentTypeSchema } from '../../lib/schemas';

/**
 * Get instrument by symbol schema
 */
const getInstrumentSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
});

export const instrumentRouter = router({
  /**
   * Search instruments by symbol or name
   */
  search: publicProcedure.input(instrumentSearchSchema).query(async ({ input }) => {
    const query = input.query.toUpperCase();

    const instruments = await db.instrument.findMany({
      where: {
        AND: [
          {
            OR: [
              { symbol: { contains: query } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          },
          input.type ? { type: input.type } : {},
          input.exchange ? { exchange: input.exchange } : {},
          { isTradeable: true },
        ],
      },
      select: {
        id: true,
        symbol: true,
        name: true,
        type: true,
        exchange: true,
        isTradeable: true,
      },
      take: input.limit,
      orderBy: [{ symbol: 'asc' }],
    });

    return instruments;
  }),

  /**
   * Get instrument by symbol
   */
  get: publicProcedure.input(getInstrumentSchema).query(async ({ input }) => {
    const instrument = await db.instrument.findFirst({
      where: {
        symbol: input.symbol,
        isTradeable: true,
      },
      select: {
        id: true,
        symbol: true,
        name: true,
        type: true,
        exchange: true,
        isTradeable: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return instrument;
  }),

  /**
   * List all tradeable instruments
   */
  list: publicProcedure
    .input(
      z.object({
        type: instrumentTypeSchema.optional(),
        exchange: z.string().max(20).optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      const instruments = await db.instrument.findMany({
        where: {
          AND: [
            { isTradeable: true },
            { isActive: true },
            input.type ? { type: input.type } : {},
            input.exchange ? { exchange: input.exchange } : {},
          ],
        },
        select: {
          id: true,
          symbol: true,
          name: true,
          type: true,
          exchange: true,
        },
        take: input.limit,
        skip: input.offset,
        orderBy: [{ symbol: 'asc' }],
      });

      const total = await db.instrument.count({
        where: {
          AND: [
            { isTradeable: true },
            { isActive: true },
            input.type ? { type: input.type } : {},
            input.exchange ? { exchange: input.exchange } : {},
          ],
        },
      });

      return {
        instruments,
        total,
        limit: input.limit,
        offset: input.offset,
      };
    }),
});
