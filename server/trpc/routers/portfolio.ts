/**
 * Portfolio tRPC Router
 *
 * Provides comprehensive portfolio summary and analytics endpoints.
 */

import { z } from 'zod';
import { router, accountProtectedProcedure } from '../trpc';
import { calculateAccountPnL, calculatePerformanceMetrics } from '../../lib/pnl-calculation';
import { getCashBalance, getBuyingPower } from '../../lib/cash-balance';
import { logger } from '../../lib/logger';
import Decimal from 'decimal.js';

/**
 * Portfolio router
 */
export const portfolioRouter = router({
  /**
   * Get comprehensive portfolio summary
   *
   * Returns account value, cash balance, positions, P&L, and performance metrics.
   */
  getSummary: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting portfolio summary',
        accountId: input.accountId,
      });

      // Get cash balance and buying power
      const [cashBalance, buyingPower] = await Promise.all([
        getCashBalance(input.accountId),
        getBuyingPower(input.accountId),
      ]);

      // Get P&L summary
      const pnlSummary = await calculateAccountPnL(input.accountId);

      // Calculate total account value
      const totalMarketValue = pnlSummary.positions.reduce(
        (sum, p) => sum.plus(p.marketValue),
        new Decimal(0)
      );

      const totalAccountValue = cashBalance.plus(totalMarketValue);

      // Get performance metrics
      const performanceMetrics = await calculatePerformanceMetrics(
        input.accountId
      );

      // Asset allocation
      const stockValue = totalMarketValue.toNumber();
      const cashValue = cashBalance.toNumber();
      const accountValue = totalAccountValue.toNumber();

      const assetAllocation = {
        stocks: {
          value: stockValue,
          percentage: accountValue > 0 ? (stockValue / accountValue) * 100 : 0,
        },
        cash: {
          value: cashValue,
          percentage: accountValue > 0 ? (cashValue / accountValue) * 100 : 0,
        },
      };

      return {
        accountId: input.accountId,
        summary: {
          totalAccountValue: totalAccountValue.toNumber(),
          cashBalance: cashBalance.toNumber(),
          buyingPower: buyingPower.toNumber(),
          totalMarketValue: totalMarketValue.toNumber(),
          totalPositions: pnlSummary.positions.length,
        },
        pnl: {
          totalRealizedPnL: pnlSummary.totalRealizedPnL.toNumber(),
          totalUnrealizedPnL: pnlSummary.totalUnrealizedPnL.toNumber(),
          totalPnL: pnlSummary.totalPnL.toNumber(),
          percentReturn: pnlSummary.percentReturn.toNumber(),
          dayPnL: pnlSummary.dayPnL?.toNumber() ?? null,
        },
        performance: {
          totalTrades: performanceMetrics.totalTrades,
          winningTrades: performanceMetrics.winningTrades,
          losingTrades: performanceMetrics.losingTrades,
          winRate: performanceMetrics.winRate,
          averageWin: performanceMetrics.averageWin.toNumber(),
          averageLoss: performanceMetrics.averageLoss.toNumber(),
          largestWin: performanceMetrics.largestWin.toNumber(),
          largestLoss: performanceMetrics.largestLoss.toNumber(),
          profitFactor: performanceMetrics.profitFactor.toNumber(),
        },
        assetAllocation,
        topPositions: pnlSummary.positions
          .sort((a, b) => b.marketValue.minus(a.marketValue).toNumber())
          .slice(0, 10)
          .map((p) => ({
            symbol: p.symbol,
            quantity: p.quantity,
            marketValue: p.marketValue.toNumber(),
            totalPnL: p.totalPnL.toNumber(),
            percentReturn: p.percentReturn.toNumber(),
          })),
      };
    }),

  /**
   * Get portfolio performance over time
   *
   * Returns historical performance data for charting.
   * This is a simplified version - a full implementation would track daily snapshots.
   */
  getPerformance: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        days: z.number().min(1).max(365).optional().default(30),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting portfolio performance',
        accountId: input.accountId,
        days: input.days,
      });

      // TODO: Implement with historical snapshots
      // For now, return placeholder data

      return {
        accountId: input.accountId,
        period: input.days,
        dataPoints: [],
        message: 'Historical performance tracking not yet implemented',
      };
    }),

  /**
   * Get asset allocation breakdown
   */
  getAllocation: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting asset allocation',
        accountId: input.accountId,
      });

      const cashBalance = await getCashBalance(input.accountId);
      const pnlSummary = await calculateAccountPnL(input.accountId);

      // Group positions by sector (if available from instrument data)
      const sectorAllocations: Record<
        string,
        { value: number; percentage: number; positions: number }
      > = {};

      let totalMarketValue = new Decimal(0);

      for (const position of pnlSummary.positions) {
        const sector = 'Technology'; // TODO: Get from Instrument table
        if (!sectorAllocations[sector]) {
          sectorAllocations[sector] = {
            value: 0,
            percentage: 0,
            positions: 0,
          };
        }

        sectorAllocations[sector].value += position.marketValue.toNumber();
        sectorAllocations[sector].positions += 1;
        totalMarketValue = totalMarketValue.plus(position.marketValue);
      }

      const totalAccountValue = cashBalance.plus(totalMarketValue);

      // Calculate percentages
      for (const sector in sectorAllocations) {
        sectorAllocations[sector].percentage =
          totalAccountValue.toNumber() > 0
            ? (sectorAllocations[sector].value / totalAccountValue.toNumber()) *
              100
            : 0;
      }

      return {
        accountId: input.accountId,
        totalAccountValue: totalAccountValue.toNumber(),
        cash: {
          value: cashBalance.toNumber(),
          percentage:
            totalAccountValue.toNumber() > 0
              ? (cashBalance.toNumber() / totalAccountValue.toNumber()) * 100
              : 0,
        },
        stocks: {
          value: totalMarketValue.toNumber(),
          percentage:
            totalAccountValue.toNumber() > 0
              ? (totalMarketValue.toNumber() / totalAccountValue.toNumber()) *
                100
              : 0,
        },
        sectors: sectorAllocations,
      };
    }),
});
