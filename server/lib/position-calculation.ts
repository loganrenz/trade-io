/**
 * Position Calculation Service
 *
 * Calculates positions from execution history using FIFO (First-In-First-Out) cost basis.
 * Handles long and short positions, partial position closures, and realized P&L tracking.
 */

import { db } from './db';
import Decimal from 'decimal.js';
import { logger } from './logger';

/**
 * Position data with calculated fields
 */
export interface CalculatedPosition {
  symbol: string;
  quantity: number;
  averageCost: Decimal;
  realizedPnL: Decimal;
  unrealizedPnL?: Decimal; // Requires current market price
  totalCost: Decimal;
}

/**
 * Execution record for FIFO calculation
 */
interface ExecutionForFIFO {
  id: string;
  side: string;
  quantity: number;
  price: Decimal;
  commission: Decimal;
  executedAt: Date;
}

/**
 * Calculate positions for an account from execution history
 *
 * @param accountId - The trading account ID
 * @returns Array of calculated positions
 */
export async function calculatePositions(
  accountId: string
): Promise<CalculatedPosition[]> {
  // Get all executions for this account, ordered chronologically
  const executions = await db.execution.findMany({
    where: {
      order: {
        accountId,
      },
    },
    select: {
      id: true,
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

  // Group executions by symbol
  const symbolGroups = new Map<string, ExecutionForFIFO[]>();

  for (const exec of executions) {
    if (!symbolGroups.has(exec.symbol)) {
      symbolGroups.set(exec.symbol, []);
    }
    symbolGroups.get(exec.symbol)!.push({
      id: exec.id,
      side: exec.side,
      quantity: exec.quantity,
      price: new Decimal(exec.price.toString()),
      commission: new Decimal(exec.commission.toString()),
      executedAt: exec.executedAt,
    });
  }

  // Calculate position for each symbol
  const positions: CalculatedPosition[] = [];

  for (const [symbol, execs] of symbolGroups) {
    const position = calculatePositionForSymbol(symbol, execs);
    if (position.quantity !== 0) {
      // Only include open positions
      positions.push(position);
    }
  }

  return positions;
}

/**
 * Calculate position for a specific symbol using FIFO
 *
 * @param symbol - Stock symbol
 * @param executions - Chronologically ordered executions for this symbol
 * @returns Calculated position
 */
export function calculatePositionForSymbol(
  symbol: string,
  executions: ExecutionForFIFO[]
): CalculatedPosition {
  // FIFO lots tracking: [quantity, cost per share]
  const lots: Array<{ quantity: number; costPerShare: Decimal }> = [];
  let totalRealizedPnL = new Decimal(0);

  for (const exec of executions) {
    const costPerShare = exec.price.plus(
      exec.commission.dividedBy(exec.quantity)
    );

    if (exec.side === 'BUY') {
      // Add new lot
      lots.push({
        quantity: exec.quantity,
        costPerShare,
      });
    } else if (exec.side === 'SELL') {
      // Remove from oldest lots (FIFO)
      let remainingToSell = exec.quantity;
      let totalCostBasis = new Decimal(0);

      while (remainingToSell > 0 && lots.length > 0) {
        const oldestLot = lots[0];

        if (oldestLot.quantity <= remainingToSell) {
          // Sell entire lot
          totalCostBasis = totalCostBasis.plus(
            oldestLot.costPerShare.times(oldestLot.quantity)
          );
          remainingToSell -= oldestLot.quantity;
          lots.shift(); // Remove lot
        } else {
          // Sell partial lot
          totalCostBasis = totalCostBasis.plus(
            oldestLot.costPerShare.times(remainingToSell)
          );
          oldestLot.quantity -= remainingToSell;
          remainingToSell = 0;
        }
      }

      // Calculate realized P&L for this sale
      const saleProceeds = exec.price
        .times(exec.quantity)
        .minus(exec.commission);
      const realizedPnLForTrade = saleProceeds.minus(totalCostBasis);
      totalRealizedPnL = totalRealizedPnL.plus(realizedPnLForTrade);

      // Handle short positions (selling more than owned)
      if (remainingToSell > 0) {
        // This is a short sale
        lots.push({
          quantity: -remainingToSell,
          costPerShare,
        });
      }
    }
  }

  // Calculate current position
  const totalQuantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);

  let averageCost = new Decimal(0);
  let totalCost = new Decimal(0);

  if (totalQuantity !== 0) {
    // Calculate weighted average cost
    totalCost = lots.reduce(
      (sum, lot) => sum.plus(lot.costPerShare.times(Math.abs(lot.quantity))),
      new Decimal(0)
    );
    averageCost = totalCost.dividedBy(Math.abs(totalQuantity));
  }

  return {
    symbol,
    quantity: totalQuantity,
    averageCost,
    realizedPnL: totalRealizedPnL,
    totalCost,
  };
}

/**
 * Get current position for a specific symbol
 *
 * @param accountId - The trading account ID
 * @param symbol - Stock symbol
 * @returns Calculated position or null if no position exists
 */
export async function getPositionForSymbol(
  accountId: string,
  symbol: string
): Promise<CalculatedPosition | null> {
  const executions = await db.execution.findMany({
    where: {
      symbol,
      order: {
        accountId,
      },
    },
    select: {
      id: true,
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

  if (executions.length === 0) {
    return null;
  }

  const execs = executions.map((e) => ({
    id: e.id,
    side: e.side,
    quantity: e.quantity,
    price: new Decimal(e.price.toString()),
    commission: new Decimal(e.commission.toString()),
    executedAt: e.executedAt,
  }));

  const position = calculatePositionForSymbol(symbol, execs);

  // Return null if position has been closed
  if (position.quantity === 0) {
    return null;
  }

  return position;
}

/**
 * Calculate unrealized P&L for a position
 *
 * @param position - The calculated position
 * @param currentPrice - Current market price
 * @returns Unrealized P&L
 */
export function calculateUnrealizedPnL(
  position: CalculatedPosition,
  currentPrice: number | Decimal
): Decimal {
  const price = new Decimal(currentPrice.toString());
  const currentValue = price.times(position.quantity);
  const costBasis = position.averageCost.times(position.quantity);
  return currentValue.minus(costBasis);
}

/**
 * Get position history for a symbol (including closed positions)
 *
 * @param accountId - The trading account ID
 * @param symbol - Stock symbol
 * @returns Array of position snapshots over time
 */
export async function getPositionHistory(
  accountId: string,
  symbol: string
): Promise<
  Array<{
    executionId: string;
    executedAt: Date;
    side: string;
    quantity: number;
    price: Decimal;
    positionAfter: CalculatedPosition;
  }>
> {
  const executions = await db.execution.findMany({
    where: {
      symbol,
      order: {
        accountId,
      },
    },
    select: {
      id: true,
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

  const history: Array<{
    executionId: string;
    executedAt: Date;
    side: string;
    quantity: number;
    price: Decimal;
    positionAfter: CalculatedPosition;
  }> = [];

  const execs = executions.map((e) => ({
    id: e.id,
    side: e.side,
    quantity: e.quantity,
    price: new Decimal(e.price.toString()),
    commission: new Decimal(e.commission.toString()),
    executedAt: e.executedAt,
  }));

  // Calculate position after each execution
  for (let i = 0; i < execs.length; i++) {
    const execsSoFar = execs.slice(0, i + 1);
    const positionAfter = calculatePositionForSymbol(symbol, execsSoFar);

    history.push({
      executionId: execs[i].id,
      executedAt: execs[i].executedAt,
      side: execs[i].side,
      quantity: execs[i].quantity,
      price: execs[i].price,
      positionAfter,
    });
  }

  return history;
}

/**
 * Sync calculated positions to the database
 *
 * Updates the Position table with current calculated values.
 * This should be called after executions are recorded.
 *
 * @param accountId - The trading account ID
 */
export async function syncPositionsToDatabase(
  accountId: string
): Promise<void> {
  const calculatedPositions = await calculatePositions(accountId);

  logger.info({
    msg: 'Syncing positions to database',
    accountId,
    positionsCount: calculatedPositions.length,
  });

  // Get existing positions in database
  const existingPositions = await db.position.findMany({
    where: { accountId },
  });

  const existingSymbols = new Set(existingPositions.map((p) => p.symbol));
  const calculatedSymbols = new Set(calculatedPositions.map((p) => p.symbol));

  // Update or create positions
  for (const calc of calculatedPositions) {
    await db.position.upsert({
      where: {
        accountId_symbol: {
          accountId,
          symbol: calc.symbol,
        },
      },
      update: {
        quantity: calc.quantity,
        averageCost: calc.averageCost.toNumber(),
        realizedPnL: calc.realizedPnL.toNumber(),
      },
      create: {
        accountId,
        symbol: calc.symbol,
        quantity: calc.quantity,
        averageCost: calc.averageCost.toNumber(),
        realizedPnL: calc.realizedPnL.toNumber(),
      },
    });
  }

  // Delete positions that have been closed
  const symbolsToDelete = [...existingSymbols].filter(
    (s) => !calculatedSymbols.has(s)
  );

  if (symbolsToDelete.length > 0) {
    await db.position.deleteMany({
      where: {
        accountId,
        symbol: {
          in: symbolsToDelete,
        },
      },
    });
  }

  logger.info({
    msg: 'Positions synced to database',
    accountId,
    updated: calculatedPositions.length,
    deleted: symbolsToDelete.length,
  });
}
