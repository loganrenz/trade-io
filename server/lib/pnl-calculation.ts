/**
 * PnL (Profit and Loss) Calculation Service
 *
 * Calculates realized and unrealized P&L for positions and accounts.
 * Provides day P&L, total P&L, and performance metrics.
 */

import { db } from './db';
import Decimal from 'decimal.js';
import { calculatePositions, calculateUnrealizedPnL } from './position-calculation';
import { getCurrentPrice } from './pricing';
import { logger } from './logger';

/**
 * Account P&L Summary
 */
export interface AccountPnLSummary {
  accountId: string;
  totalRealizedPnL: Decimal;
  totalUnrealizedPnL: Decimal;
  totalPnL: Decimal;
  dayPnL: Decimal | null;
  percentReturn: Decimal;
  positions: PositionPnL[];
}

/**
 * Position P&L Details
 */
export interface PositionPnL {
  symbol: string;
  quantity: number;
  averageCost: Decimal;
  currentPrice: Decimal;
  marketValue: Decimal;
  totalCost: Decimal;
  realizedPnL: Decimal;
  unrealizedPnL: Decimal;
  totalPnL: Decimal;
  percentReturn: Decimal;
  dayPnL: Decimal | null;
}

/**
 * Performance Metrics
 */
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: Decimal;
  averageLoss: Decimal;
  largestWin: Decimal;
  largestLoss: Decimal;
  profitFactor: Decimal;
  totalRealizedPnL: Decimal;
}

/**
 * Calculate comprehensive P&L for an account
 *
 * @param accountId - The trading account ID
 * @returns Account P&L summary with all positions
 */
export async function calculateAccountPnL(
  accountId: string
): Promise<AccountPnLSummary> {
  const positions = await calculatePositions(accountId);

  const positionPnLs: PositionPnL[] = [];
  let totalRealizedPnL = new Decimal(0);
  let totalUnrealizedPnL = new Decimal(0);

  for (const position of positions) {
    try {
      const currentPrice = await getCurrentPrice(position.symbol);
      const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);
      const marketValue = currentPrice.times(position.quantity);
      const totalPnL = position.realizedPnL.plus(unrealizedPnL);

      const percentReturn = position.totalCost.isZero()
        ? new Decimal(0)
        : unrealizedPnL.dividedBy(position.totalCost.abs()).times(100);

      // Calculate day P&L (would need previous close price - placeholder for now)
      const dayPnL = null; // TODO: Implement with historical price data

      positionPnLs.push({
        symbol: position.symbol,
        quantity: position.quantity,
        averageCost: position.averageCost,
        currentPrice,
        marketValue,
        totalCost: position.totalCost,
        realizedPnL: position.realizedPnL,
        unrealizedPnL,
        totalPnL,
        percentReturn,
        dayPnL,
      });

      totalRealizedPnL = totalRealizedPnL.plus(position.realizedPnL);
      totalUnrealizedPnL = totalUnrealizedPnL.plus(unrealizedPnL);
    } catch (error) {
      logger.warn({
        msg: 'Failed to calculate P&L for position',
        symbol: position.symbol,
        error,
      });
    }
  }

  const totalPnL = totalRealizedPnL.plus(totalUnrealizedPnL);
  const totalCost = positionPnLs.reduce(
    (sum, p) => sum.plus(p.totalCost.abs()),
    new Decimal(0)
  );

  const percentReturn = totalCost.isZero()
    ? new Decimal(0)
    : totalPnL.dividedBy(totalCost).times(100);

  return {
    accountId,
    totalRealizedPnL,
    totalUnrealizedPnL,
    totalPnL,
    dayPnL: null, // TODO: Implement with historical price data
    percentReturn,
    positions: positionPnLs,
  };
}

/**
 * Calculate realized P&L only
 *
 * @param accountId - The trading account ID
 * @returns Total realized P&L across all closed and open positions
 */
export async function calculateRealizedPnL(accountId: string): Promise<Decimal> {
  const positions = await calculatePositions(accountId);

  const totalRealizedPnL = positions.reduce(
    (sum, p) => sum.plus(p.realizedPnL),
    new Decimal(0)
  );

  return totalRealizedPnL;
}

/**
 * Calculate unrealized P&L only
 *
 * @param accountId - The trading account ID
 * @returns Total unrealized P&L across all open positions
 */
export async function calculateUnrealizedPnLTotal(
  accountId: string
): Promise<Decimal> {
  const positions = await calculatePositions(accountId);

  let totalUnrealizedPnL = new Decimal(0);

  for (const position of positions) {
    try {
      const currentPrice = await getCurrentPrice(position.symbol);
      const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);
      totalUnrealizedPnL = totalUnrealizedPnL.plus(unrealizedPnL);
    } catch (error) {
      logger.warn({
        msg: 'Failed to get price for unrealized P&L calculation',
        symbol: position.symbol,
      });
    }
  }

  return totalUnrealizedPnL;
}

/**
 * Calculate day P&L (profit/loss for the current trading day)
 *
 * @param accountId - The trading account ID
 * @returns Day P&L or null if cannot be calculated
 */
export async function calculateDayPnL(
  accountId: string
): Promise<Decimal | null> {
  // TODO: Implement with historical price data
  // Need to track previous close prices and compare to current prices
  // Also need to account for executions that happened today

  logger.info({
    msg: 'Day P&L calculation not yet implemented',
    accountId,
  });

  return null;
}

/**
 * Calculate performance metrics from trading history
 *
 * @param accountId - The trading account ID
 * @returns Performance metrics including win rate, profit factor, etc.
 */
export async function calculatePerformanceMetrics(
  accountId: string
): Promise<PerformanceMetrics> {
  // Get all closed positions (round-trip trades)
  const executions = await db.execution.findMany({
    where: {
      order: {
        accountId,
      },
    },
    select: {
      symbol: true,
      side: true,
      quantity: true,
      price: true,
      commission: true,
      executedAt: true,
    },
    orderBy: {
      executedAt: 'asc',
    },
  });

  // Group by symbol and calculate round-trip P&L
  const symbolGroups = new Map<
    string,
    Array<{
      side: string;
      quantity: number;
      price: Decimal;
      commission: Decimal;
      executedAt: Date;
    }>
  >();

  for (const exec of executions) {
    if (!symbolGroups.has(exec.symbol)) {
      symbolGroups.set(exec.symbol, []);
    }
    symbolGroups.get(exec.symbol)!.push({
      side: exec.side,
      quantity: exec.quantity,
      price: new Decimal(exec.price.toString()),
      commission: new Decimal(exec.commission.toString()),
      executedAt: exec.executedAt,
    });
  }

  const roundTripPnLs: Decimal[] = [];

  for (const [symbol, execs] of symbolGroups) {
    const lots: Array<{ quantity: number; costPerShare: Decimal }> = [];

    for (const exec of execs) {
      const costPerShare = exec.price.plus(
        exec.commission.dividedBy(exec.quantity)
      );

      if (exec.side === 'BUY') {
        lots.push({ quantity: exec.quantity, costPerShare });
      } else {
        // SELL - calculate realized P&L
        let remainingToSell = exec.quantity;
        let totalCostBasis = new Decimal(0);

        while (remainingToSell > 0 && lots.length > 0) {
          const oldestLot = lots[0];

          if (oldestLot.quantity <= remainingToSell) {
            totalCostBasis = totalCostBasis.plus(
              oldestLot.costPerShare.times(oldestLot.quantity)
            );
            remainingToSell -= oldestLot.quantity;
            lots.shift();
          } else {
            totalCostBasis = totalCostBasis.plus(
              oldestLot.costPerShare.times(remainingToSell)
            );
            oldestLot.quantity -= remainingToSell;
            remainingToSell = 0;
          }
        }

        const saleProceeds = exec.price
          .times(exec.quantity)
          .minus(exec.commission);
        const pnl = saleProceeds.minus(totalCostBasis);

        if (pnl.abs().greaterThan(0.01)) {
          // Only count if meaningful
          roundTripPnLs.push(pnl);
        }
      }
    }
  }

  const totalTrades = roundTripPnLs.length;
  const winningTrades = roundTripPnLs.filter((p) => p.greaterThan(0));
  const losingTrades = roundTripPnLs.filter((p) => p.lessThan(0));

  const totalWins = winningTrades.reduce(
    (sum, p) => sum.plus(p),
    new Decimal(0)
  );
  const totalLosses = losingTrades.reduce(
    (sum, p) => sum.plus(p.abs()),
    new Decimal(0)
  );

  const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const averageWin =
    winningTrades.length > 0
      ? totalWins.dividedBy(winningTrades.length)
      : new Decimal(0);

  const averageLoss =
    losingTrades.length > 0
      ? totalLosses.dividedBy(losingTrades.length)
      : new Decimal(0);

  const largestWin =
    winningTrades.length > 0
      ? winningTrades.reduce((max, p) => (p.greaterThan(max) ? p : max))
      : new Decimal(0);

  const largestLoss =
    losingTrades.length > 0
      ? losingTrades.reduce((max, p) => (p.abs().greaterThan(max.abs()) ? p : max))
      : new Decimal(0);

  const profitFactor = totalLosses.isZero()
    ? new Decimal(0)
    : totalWins.dividedBy(totalLosses);

  const totalRealizedPnL = roundTripPnLs.reduce(
    (sum, p) => sum.plus(p),
    new Decimal(0)
  );

  return {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    averageWin,
    averageLoss,
    largestWin,
    largestLoss,
    profitFactor,
    totalRealizedPnL,
  };
}

/**
 * Get P&L for a specific date range
 *
 * @param accountId - The trading account ID
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Realized P&L for the date range
 */
export async function getPnLForDateRange(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<Decimal> {
  const executions = await db.execution.findMany({
    where: {
      order: {
        accountId,
      },
      executedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      symbol: true,
      side: true,
      quantity: true,
      price: true,
      commission: true,
      executedAt: true,
    },
    orderBy: {
      executedAt: 'asc',
    },
  });

  // Calculate realized P&L from sales in this date range
  // This is simplified - a full implementation would need all prior executions
  // to properly calculate cost basis using FIFO

  logger.info({
    msg: 'Date range P&L calculation is simplified',
    accountId,
    startDate,
    endDate,
    executionsInRange: executions.length,
  });

  return new Decimal(0); // TODO: Implement proper date-range P&L
}
