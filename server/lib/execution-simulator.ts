/**
 * Execution Simulator
 * Simulates order execution for paper trading
 */
import { db } from './db';
import { logger } from './logger';
import { getCurrentPrice, getSpread } from './pricing';
import { recordTransaction, type LedgerTransaction } from './ledger-service';
import Decimal from 'decimal.js';

/**
 * Simulated slippage percentage for market orders
 * In production, this should be configurable based on:
 * - Market volatility
 * - Order size vs average volume
 * - Current bid-ask spread
 */
const MARKET_SLIPPAGE_PERCENT = 0.001; // 0.1% slippage

/**
 * Commission per execution
 * Set to $0 for paper trading
 */
const COMMISSION_PER_EXECUTION = 0;

/**
 * Simulate execution for an order
 * This is a simplified execution simulator for market orders
 */
export async function simulateExecution(orderId: string): Promise<void> {
  try {
    // Get order
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      logger.warn({ orderId }, 'Order not found for execution simulation');
      return;
    }

    // Only execute PENDING or ACCEPTED orders
    if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
      logger.info({ orderId, status: order.status }, 'Order not in executable state');
      return;
    }

    // Update order to ACCEPTED status first
    if (order.status === 'PENDING') {
      await db.order.update({
        where: { id: orderId },
        data: { status: 'ACCEPTED' },
      });

      await db.orderEvent.create({
        data: {
          orderId,
          eventType: 'ACCEPTED',
          oldStatus: 'PENDING',
          newStatus: 'ACCEPTED',
        },
      });
    }

    // Determine execution price based on order type
    let executionPrice: number | null = null;

    if (order.orderType === 'MARKET') {
      // Market orders execute at current price with slippage
      executionPrice = await getMarketExecutionPrice(order.symbol, order.side);
    } else if (order.orderType === 'LIMIT' && order.limitPrice) {
      // Limit orders execute at limit price (if market allows)
      const currentPrice = await getCurrentPrice(order.symbol);

      if (currentPrice) {
        if (order.side === 'BUY' && currentPrice <= Number(order.limitPrice)) {
          executionPrice = Number(order.limitPrice);
        } else if (order.side === 'SELL' && currentPrice >= Number(order.limitPrice)) {
          executionPrice = Number(order.limitPrice);
        }
      }
    }

    if (!executionPrice) {
      logger.warn({ orderId, symbol: order.symbol }, 'Unable to determine execution price');
      return;
    }

    // Execute the order (simplified - full fill for now)
    const quantityToFill = order.quantity - order.filledQuantity;

    if (quantityToFill <= 0) {
      logger.info({ orderId }, 'Order already fully filled');
      return;
    }

    // Create execution record
    const execution = await db.execution.create({
      data: {
        orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: quantityToFill,
        price: executionPrice,
        commission: COMMISSION_PER_EXECUTION,
        executedAt: new Date(),
      },
    });

    // Update order
    const newFilledQuantity = order.filledQuantity + quantityToFill;
    const newStatus = newFilledQuantity >= order.quantity ? 'FILLED' : 'PARTIAL';

    await db.order.update({
      where: { id: orderId },
      data: {
        filledQuantity: newFilledQuantity,
        averagePrice: executionPrice,
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    // Create execution event
    await db.orderEvent.create({
      data: {
        orderId,
        eventType: newStatus === 'FILLED' ? 'FILLED' : 'PARTIAL_FILL',
        oldStatus: 'ACCEPTED',
        newStatus,
        metadata: {
          executionId: execution.id,
          quantity: quantityToFill,
          price: executionPrice,
        },
      },
    });

    // Update position
    await updatePosition({
      accountId: order.accountId,
      symbol: order.symbol,
      side: order.side,
      quantity: quantityToFill,
      price: executionPrice,
    });

    // Create ledger entries
    await createLedgerEntries({
      accountId: order.accountId,
      symbol: order.symbol,
      side: order.side,
      quantity: quantityToFill,
      price: executionPrice,
      orderId,
      executionId: execution.id,
    });

    logger.info(
      {
        orderId,
        executionId: execution.id,
        symbol: order.symbol,
        side: order.side,
        quantity: quantityToFill,
        price: executionPrice,
        status: newStatus,
      },
      'Order executed'
    );
  } catch (error) {
    logger.error({ error, orderId }, 'Failed to simulate execution');

    // Mark order as rejected on error
    await db.order
      .update({
        where: { id: orderId },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Execution simulation failed',
        },
      })
      .catch((updateError) => {
        logger.error({ error: updateError, orderId }, 'Failed to update order status to REJECTED');
      });
  }
}

/**
 * Get market execution price with simulated slippage
 */
async function getMarketExecutionPrice(symbol: string, side: string): Promise<number | null> {
  // Get current spread
  const spread = await getSpread(symbol);

  if (!spread) {
    // Fall back to last price
    return await getCurrentPrice(symbol);
  }

  // For BUY orders, execute at ask price (or slightly above)
  // For SELL orders, execute at bid price (or slightly below)

  if (side === 'BUY') {
    return spread.ask * (1 + MARKET_SLIPPAGE_PERCENT);
  } else {
    return spread.bid * (1 - MARKET_SLIPPAGE_PERCENT);
  }
}

/**
 * Update or create position after execution
 */
async function updatePosition(params: {
  accountId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
}): Promise<void> {
  const { accountId, symbol, side, quantity, price } = params;

  // Get existing position
  const existingPosition = await db.position.findFirst({
    where: {
      accountId,
      symbol,
    },
  });

  if (!existingPosition) {
    // Create new position
    await db.position.create({
      data: {
        accountId,
        symbol,
        quantity: side === 'BUY' ? quantity : -quantity,
        averageCost: price,
        realizedPnL: 0,
      },
    });
  } else {
    // Update existing position
    const currentQty = existingPosition.quantity;
    const currentAvgCost = Number(existingPosition.averageCost);
    const currentRealizedPnL = Number(existingPosition.realizedPnL);

    let newQty: number;
    let newAvgCost: number;
    let newRealizedPnL: number = currentRealizedPnL;

    if (side === 'BUY') {
      newQty = currentQty + quantity;

      if (currentQty >= 0) {
        // Adding to long position
        newAvgCost = (currentQty * currentAvgCost + quantity * price) / newQty;
      } else {
        // Covering short position
        if (newQty >= 0) {
          // Fully covered or reversed to long
          const coveredQty = Math.min(quantity, Math.abs(currentQty));
          newRealizedPnL += coveredQty * (currentAvgCost - price);

          if (newQty > 0) {
            newAvgCost = price;
          } else {
            newAvgCost = currentAvgCost;
          }
        } else {
          // Partially covered
          newRealizedPnL += quantity * (currentAvgCost - price);
          newAvgCost = currentAvgCost;
        }
      }
    } else {
      // SELL
      newQty = currentQty - quantity;

      if (currentQty <= 0) {
        // Adding to short position
        newAvgCost = (Math.abs(currentQty) * currentAvgCost + quantity * price) / Math.abs(newQty);
      } else {
        // Reducing long position or going short
        if (newQty >= 0) {
          // Partially or fully sold long position
          newRealizedPnL += quantity * (price - currentAvgCost);
          newAvgCost = currentAvgCost;
        } else {
          // Sold all long and went short
          const soldLongQty = currentQty;
          newRealizedPnL += soldLongQty * (price - currentAvgCost);
          newAvgCost = price;
        }
      }
    }

    await db.position.update({
      where: { id: existingPosition.id },
      data: {
        quantity: newQty,
        averageCost: newAvgCost,
        realizedPnL: newRealizedPnL,
      },
    });
  }
}

/**
 * Create ledger entries for trade execution using double-entry bookkeeping
 *
 * For a BUY trade:
 * - DEBIT: Securities (increase asset)
 * - CREDIT: Cash (decrease asset)
 *
 * For a SELL trade:
 * - DEBIT: Cash (increase asset)
 * - CREDIT: Securities (decrease asset)
 */
async function createLedgerEntries(params: {
  accountId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  orderId: string;
  executionId: string;
}): Promise<void> {
  const { accountId, symbol, side, quantity, price, executionId } = params;

  const tradeValue = new Decimal(quantity).times(new Decimal(price));

  // Build double-entry transaction
  const transaction: LedgerTransaction = {
    accountId,
    description: `${side} ${quantity} ${symbol} @ $${new Decimal(price).toFixed(2)}`,
    referenceType: 'EXECUTION',
    referenceId: executionId,
    entries: [],
  };

  if (side === 'BUY') {
    // Buying: Securities increase (DEBIT), Cash decreases (CREDIT)
    transaction.entries = [
      {
        ledgerAccountSubtype: 'SECURITIES',
        entryType: 'DEBIT',
        amount: tradeValue.toString(),
        metadata: { symbol, quantity, price },
      },
      {
        ledgerAccountSubtype: 'CASH',
        entryType: 'CREDIT',
        amount: tradeValue.toString(),
        metadata: { symbol, quantity, price },
      },
    ];
  } else {
    // Selling: Cash increases (DEBIT), Securities decrease (CREDIT)
    transaction.entries = [
      {
        ledgerAccountSubtype: 'CASH',
        entryType: 'DEBIT',
        amount: tradeValue.toString(),
        metadata: { symbol, quantity, price },
      },
      {
        ledgerAccountSubtype: 'SECURITIES',
        entryType: 'CREDIT',
        amount: tradeValue.toString(),
        metadata: { symbol, quantity, price },
      },
    ];
  }

  // Record the transaction
  await recordTransaction(transaction);

  logger.info(
    {
      accountId,
      symbol,
      side,
      quantity,
      price,
      tradeValue: tradeValue.toString(),
    },
    'Ledger entries created for trade execution'
  );
}
