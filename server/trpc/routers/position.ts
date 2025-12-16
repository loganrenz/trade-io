/**
 * Position tRPC Router
 *
 * Provides endpoints for querying positions and position history.
 */

import { z } from 'zod';
import { router, accountProtectedProcedure } from '../trpc';
import {
  calculatePositions,
  getPositionForSymbol,
  getPositionHistory,
  calculateUnrealizedPnL,
} from '../../lib/position-calculation';
import { getCurrentPrice } from '../../lib/pricing';
import { logger } from '../../lib/logger';

/**
 * Position router
 */
export const positionRouter = router({
  /**
   * List all positions for an account
   *
   * Returns current positions with unrealized P&L calculated using current market prices.
   */
  list: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Listing positions',
        accountId: input.accountId,
      });

      // Calculate positions from execution history
      const positions = await calculatePositions(input.accountId);

      // Enrich with current market prices and unrealized P&L
      const enrichedPositions = await Promise.all(
        positions.map(async (position) => {
          try {
            const currentPrice = await getCurrentPrice(position.symbol);

            const unrealizedPnL = calculateUnrealizedPnL(
              position,
              currentPrice
            );

            return {
              symbol: position.symbol,
              quantity: position.quantity,
              averageCost: position.averageCost.toNumber(),
              currentPrice: currentPrice.toNumber(),
              marketValue: currentPrice.times(position.quantity).toNumber(),
              totalCost: position.totalCost.toNumber(),
              realizedPnL: position.realizedPnL.toNumber(),
              unrealizedPnL: unrealizedPnL.toNumber(),
              totalPnL: position.realizedPnL.plus(unrealizedPnL).toNumber(),
              percentReturn: position.totalCost.isZero()
                ? 0
                : unrealizedPnL
                    .dividedBy(position.totalCost.abs())
                    .times(100)
                    .toNumber(),
            };
          } catch (error) {
            // If we can't get current price, return position without unrealized P&L
            logger.warn({
              msg: 'Failed to get current price for position',
              symbol: position.symbol,
              error,
            });

            return {
              symbol: position.symbol,
              quantity: position.quantity,
              averageCost: position.averageCost.toNumber(),
              currentPrice: null,
              marketValue: null,
              totalCost: position.totalCost.toNumber(),
              realizedPnL: position.realizedPnL.toNumber(),
              unrealizedPnL: null,
              totalPnL: null,
              percentReturn: null,
            };
          }
        })
      );

      return {
        positions: enrichedPositions,
        totalCount: enrichedPositions.length,
      };
    }),

  /**
   * Get position details for a specific symbol
   */
  getBySymbol: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        symbol: z.string().min(1).max(10).toUpperCase(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting position by symbol',
        accountId: input.accountId,
        symbol: input.symbol,
      });

      const position = await getPositionForSymbol(
        input.accountId,
        input.symbol
      );

      if (!position) {
        return null;
      }

      try {
        const currentPrice = await getCurrentPrice(input.symbol);
        const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);

        return {
          symbol: position.symbol,
          quantity: position.quantity,
          averageCost: position.averageCost.toNumber(),
          currentPrice: currentPrice.toNumber(),
          marketValue: currentPrice.times(position.quantity).toNumber(),
          totalCost: position.totalCost.toNumber(),
          realizedPnL: position.realizedPnL.toNumber(),
          unrealizedPnL: unrealizedPnL.toNumber(),
          totalPnL: position.realizedPnL.plus(unrealizedPnL).toNumber(),
          percentReturn: position.totalCost.isZero()
            ? 0
            : unrealizedPnL
                .dividedBy(position.totalCost.abs())
                .times(100)
                .toNumber(),
        };
      } catch (error) {
        logger.warn({
          msg: 'Failed to get current price for position',
          symbol: input.symbol,
          error,
        });

        return {
          symbol: position.symbol,
          quantity: position.quantity,
          averageCost: position.averageCost.toNumber(),
          currentPrice: null,
          marketValue: null,
          totalCost: position.totalCost.toNumber(),
          realizedPnL: position.realizedPnL.toNumber(),
          unrealizedPnL: null,
          totalPnL: null,
          percentReturn: null,
        };
      }
    }),

  /**
   * Get position history for a symbol
   *
   * Shows how the position changed over time with each execution.
   */
  getHistory: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        symbol: z.string().min(1).max(10).toUpperCase(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting position history',
        accountId: input.accountId,
        symbol: input.symbol,
      });

      const history = await getPositionHistory(input.accountId, input.symbol);

      return {
        symbol: input.symbol,
        history: history.map((h) => ({
          executionId: h.executionId,
          executedAt: h.executedAt,
          side: h.side,
          quantity: h.quantity,
          price: h.price.toNumber(),
          positionAfter: {
            quantity: h.positionAfter.quantity,
            averageCost: h.positionAfter.averageCost.toNumber(),
            totalCost: h.positionAfter.totalCost.toNumber(),
            realizedPnL: h.positionAfter.realizedPnL.toNumber(),
          },
        })),
        totalTransactions: history.length,
      };
    }),

  /**
   * Get summary of all positions
   *
   * Returns aggregate metrics across all positions.
   */
  getSummary: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting position summary',
        accountId: input.accountId,
      });

      const positions = await calculatePositions(input.accountId);

      let totalMarketValue = 0;
      let totalCost = 0;
      let totalRealizedPnL = 0;
      let totalUnrealizedPnL = 0;
      let positionsWithPrices = 0;

      for (const position of positions) {
        totalCost += position.totalCost.toNumber();
        totalRealizedPnL += position.realizedPnL.toNumber();

        try {
          const currentPrice = await getCurrentPrice(position.symbol);
          const marketValue = currentPrice.times(position.quantity).toNumber();
          const unrealizedPnL = calculateUnrealizedPnL(
            position,
            currentPrice
          ).toNumber();

          totalMarketValue += marketValue;
          totalUnrealizedPnL += unrealizedPnL;
          positionsWithPrices++;
        } catch (error) {
          logger.warn({
            msg: 'Failed to get price for position in summary',
            symbol: position.symbol,
          });
        }
      }

      const totalPnL = totalRealizedPnL + totalUnrealizedPnL;
      const percentReturn =
        totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;

      return {
        totalPositions: positions.length,
        positionsWithPrices,
        totalMarketValue,
        totalCost,
        totalRealizedPnL,
        totalUnrealizedPnL,
        totalPnL,
        percentReturn,
      };
    }),
});
