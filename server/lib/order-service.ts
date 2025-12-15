/**
 * Order Service
 * Business logic for order management
 */
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import {
  validateOrder,
  validateOrderModification,
  validateOrderCancellation,
} from './order-validation';
import { logger } from './logger';
import { InvalidOrderError, ConcurrencyError } from '../errors';

/**
 * Place a new order
 */
export async function placeOrder(
  params: {
    accountId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    limitPrice?: number;
    stopPrice?: number;
    timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  },
  userId: string,
  idempotencyKey: string
): Promise<unknown> {
  // Check for duplicate idempotency key
  const existing = await db.order.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    logger.info(
      { orderId: existing.id, idempotencyKey },
      'Duplicate order request, returning existing order'
    );
    return existing;
  }

  // Validate order
  await validateOrder(params);

  // Calculate expiration time for DAY orders
  let expiresAt: Date | null = null;
  if (params.timeInForce === 'DAY') {
    // Set expiration to market close (4:00 PM ET)
    const now = new Date();
    expiresAt = new Date(now);
    expiresAt.setHours(16, 0, 0, 0); // 4:00 PM
    if (expiresAt <= now) {
      // If after market close, set to next trading day
      expiresAt.setDate(expiresAt.getDate() + 1);
    }
  }

  // Create order
  const order = await db.order.create({
    data: {
      accountId: params.accountId,
      symbol: params.symbol.toUpperCase(),
      side: params.side,
      quantity: params.quantity,
      orderType: params.orderType,
      limitPrice: params.limitPrice ? new Decimal(params.limitPrice) : null,
      stopPrice: params.stopPrice ? new Decimal(params.stopPrice) : null,
      timeInForce: params.timeInForce,
      status: 'PENDING',
      idempotencyKey,
      expiresAt,
    },
  });

  // Create order event
  await db.orderEvent.create({
    data: {
      orderId: order.id,
      eventType: 'CREATED',
      oldStatus: null,
      newStatus: 'PENDING',
      metadata: {
        orderType: params.orderType,
        timeInForce: params.timeInForce,
      },
    },
  });

  // Audit log
  await audit({
    userId,
    action: 'ORDER_PLACED',
    resource: 'order',
    resourceId: order.id,
    metadata: {
      accountId: params.accountId,
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      orderType: params.orderType,
    },
  });

  logger.info(
    { orderId: order.id, symbol: params.symbol, side: params.side },
    'Order placed successfully'
  );

  return order;
}

/**
 * Modify an existing order
 */
export async function modifyOrder(
  orderId: string,
  params: {
    quantity?: number;
    limitPrice?: number;
    stopPrice?: number;
  },
  userId: string
): Promise<unknown> {
  // Validate modification
  await validateOrderModification({ orderId, ...params });

  // Get current order with optimistic locking
  const currentOrder = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!currentOrder) {
    throw new InvalidOrderError('Order not found');
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    version: currentOrder.version + 1,
  };

  if (params.quantity !== undefined) {
    updateData.quantity = params.quantity;
  }

  if (params.limitPrice !== undefined) {
    updateData.limitPrice = new Decimal(params.limitPrice);
  }

  if (params.stopPrice !== undefined) {
    updateData.stopPrice = new Decimal(params.stopPrice);
  }

  // Update with optimistic locking
  try {
    const updatedOrder = await db.order.updateMany({
      where: {
        id: orderId,
        version: currentOrder.version,
      },
      data: updateData,
    });

    if (updatedOrder.count === 0) {
      throw new ConcurrencyError('Order was modified by another request. Please retry.');
    }

    // Get updated order
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    // Create order event
    await db.orderEvent.create({
      data: {
        orderId,
        eventType: 'MODIFIED',
        oldStatus: currentOrder.status,
        newStatus: currentOrder.status,
        metadata: params,
      },
    });

    // Audit log
    await audit({
      userId,
      action: 'ORDER_MODIFIED',
      resource: 'order',
      resourceId: orderId,
      metadata: params,
    });

    logger.info({ orderId }, 'Order modified successfully');

    return order;
  } catch (error) {
    // Re-throw ConcurrencyError for client handling
    if (error instanceof ConcurrencyError) {
      throw error;
    }
    // Log and re-throw unexpected errors
    logger.error({ orderId, error }, 'Unexpected error modifying order');
 * Handles order placement, validation, and execution simulation
 */
import { db } from './db';
import { logger } from './logger';
import { audit } from './audit';
import { getCurrentPrice } from './pricing';
import { isExchangeOpen, getTradingHours } from './trading-hours';
import { Decimal } from 'decimal.js';
import {
  ValidationError,
  InsufficientFundsError,
  InvalidOrderError,
  MarketClosedError,
  InvalidSymbolError,
} from '../errors';

export interface PlaceOrderParams {
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce?: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  userId: string; // For audit logging
}

export interface PlaceOrderResult {
  order: {
    id: string;
    accountId: string;
    symbol: string;
    side: string;
    quantity: number;
    orderType: string;
    limitPrice: number | null;
    stopPrice: number | null;
    status: string;
    filledQuantity: number;
    averagePrice: number | null;
    timeInForce: string;
    idempotencyKey: string;
    createdAt: Date;
    updatedAt: Date;
  };
  execution?: {
    id: string;
    orderId: string;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
    commission: number;
    executedAt: Date;
  };
}

/**
 * Place a new order with validation and execution simulation
 */
export async function placeOrder(
  params: PlaceOrderParams,
  idempotencyKey: string
): Promise<PlaceOrderResult> {
  const { accountId, symbol, side, quantity, orderType, limitPrice, stopPrice, timeInForce, userId } = params;

  try {
    // 1. Check for existing order with this idempotency key
    const existingOrder = await db.order.findUnique({
      where: { idempotencyKey },
      include: {
        executions: true,
      },
    });

    if (existingOrder) {
      logger.info({ orderId: existingOrder.id }, 'Returning existing order for idempotency key');
      return {
        order: {
          id: existingOrder.id,
          accountId: existingOrder.accountId,
          symbol: existingOrder.symbol,
          side: existingOrder.side,
          quantity: existingOrder.quantity,
          orderType: existingOrder.orderType,
          limitPrice: existingOrder.limitPrice ? Number(existingOrder.limitPrice) : null,
          stopPrice: existingOrder.stopPrice ? Number(existingOrder.stopPrice) : null,
          status: existingOrder.status,
          filledQuantity: existingOrder.filledQuantity,
          averagePrice: existingOrder.averagePrice ? Number(existingOrder.averagePrice) : null,
          timeInForce: existingOrder.timeInForce,
          idempotencyKey: existingOrder.idempotencyKey,
          createdAt: existingOrder.createdAt,
          updatedAt: existingOrder.updatedAt,
        },
        execution: existingOrder.executions[0] ? {
          id: existingOrder.executions[0].id,
          orderId: existingOrder.executions[0].orderId,
          symbol: existingOrder.executions[0].symbol,
          side: existingOrder.executions[0].side,
          quantity: existingOrder.executions[0].quantity,
          price: Number(existingOrder.executions[0].price),
          commission: Number(existingOrder.executions[0].commission),
          executedAt: existingOrder.executions[0].executedAt,
        } : undefined,
      };
    }

    // 2. Validate account
    const account = await db.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new ValidationError('Account not found');
    }

    if (account.status !== 'ACTIVE') {
      throw new ValidationError(`Account is ${account.status.toLowerCase()} and cannot place orders`);
    }

    // 3. Validate instrument
    const instrument = await db.instrument.findUnique({
      where: { symbol },
    });

    if (!instrument) {
      throw new InvalidSymbolError(symbol, 'not found');
    }

    if (!instrument.isTradeable || !instrument.isActive) {
      throw new InvalidSymbolError(symbol, 'not tradeable');
    }

    // 4. Validate trading hours for market orders
    if (orderType === 'MARKET') {
      const isOpen = await isExchangeOpen(instrument.exchange);
      if (!isOpen) {
        const hoursInfo = await getTradingHours(instrument.exchange);
        throw new MarketClosedError(
          `Market is closed for ${instrument.exchange}. Next open: ${hoursInfo.nextOpen?.toISOString() || 'Unknown'}`
        );
      }
    }

    // 5. Validate order parameters
    validateOrderParams({ orderType, limitPrice, stopPrice, quantity });

    // 6. Check buying power for BUY orders
    if (side === 'BUY') {
      const estimatedCost = await estimateOrderCost({
        symbol,
        quantity,
        orderType,
        limitPrice,
      });

      const buyingPower = await calculateBuyingPower(accountId);

      if (buyingPower.lt(estimatedCost)) {
        throw new InsufficientFundsError(
          estimatedCost.toNumber(),
          buyingPower.toNumber()
        );
      }
    }

    // 7. Check position for SELL orders
    if (side === 'SELL') {
      const position = await db.position.findUnique({
        where: {
          accountId_symbol: {
            accountId,
            symbol,
          },
        },
      });

      if (!position || position.quantity < quantity) {
        throw new InvalidOrderError(
          `Insufficient position to sell. Requested: ${quantity}, Available: ${position?.quantity || 0}`
        );
      }
    }

    // 8. Create order and execute if market order
    const result = await db.$transaction(async (tx) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          accountId,
          symbol,
          side,
          quantity,
          orderType,
          limitPrice: limitPrice ? new Decimal(limitPrice).toNumber() : null,
          stopPrice: stopPrice ? new Decimal(stopPrice).toNumber() : null,
          timeInForce: timeInForce || 'DAY',
          status: orderType === 'MARKET' ? 'ACCEPTED' : 'PENDING',
          idempotencyKey,
          filledQuantity: 0,
        },
      });

      // Create order event
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'CREATED',
          oldStatus: null,
          newStatus: order.status,
          metadata: {
            orderType,
            timeInForce: timeInForce || 'DAY',
          },
        },
      });

      // Execute market orders immediately
      let execution = null;
      if (orderType === 'MARKET') {
        execution = await executeMarketOrder(order, tx);
      }

      return { order, execution };
    });

    // 9. Audit log
    await audit({
      actor: userId,
      action: 'ORDER_PLACED',
      resource: 'order',
      resourceId: result.order.id,
      metadata: {
        accountId,
        symbol,
        side,
        quantity,
        orderType,
        status: result.order.status,
      },
    });

    logger.info(
      {
        orderId: result.order.id,
        accountId,
        symbol,
        side,
        quantity,
        orderType,
        status: result.order.status,
      },
      'Order placed successfully'
    );

    return {
      order: {
        id: result.order.id,
        accountId: result.order.accountId,
        symbol: result.order.symbol,
        side: result.order.side,
        quantity: result.order.quantity,
        orderType: result.order.orderType,
        limitPrice: result.order.limitPrice ? Number(result.order.limitPrice) : null,
        stopPrice: result.order.stopPrice ? Number(result.order.stopPrice) : null,
        status: result.order.status,
        filledQuantity: result.order.filledQuantity,
        averagePrice: result.order.averagePrice ? Number(result.order.averagePrice) : null,
        timeInForce: result.order.timeInForce,
        idempotencyKey: result.order.idempotencyKey,
        createdAt: result.order.createdAt,
        updatedAt: result.order.updatedAt,
      },
      execution: result.execution ? {
        id: result.execution.id,
        orderId: result.execution.orderId,
        symbol: result.execution.symbol,
        side: result.execution.side,
        quantity: result.execution.quantity,
        price: Number(result.execution.price),
        commission: Number(result.execution.commission),
        executedAt: result.execution.executedAt,
      } : undefined,
    };
  } catch (error) {
    logger.error({ error, params, idempotencyKey }, 'Failed to place order');
    throw error;
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string, userId: string): Promise<unknown> {
  // Validate cancellation
  await validateOrderCancellation(orderId);

  // Get current order
  const currentOrder = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!currentOrder) {
    throw new InvalidOrderError('Order not found');
  }

  // Update order status with optimistic locking
  try {
    const result = await db.order.updateMany({
      where: {
        id: orderId,
        version: currentOrder.version,
      },
      data: {
        status: 'CANCELLED',
        version: currentOrder.version + 1,
      },
    });

    if (result.count === 0) {
      throw new ConcurrencyError('Order was modified by another request. Please retry.');
    }

    // Get updated order
    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    // Create order event
    await db.orderEvent.create({
      data: {
        orderId,
        eventType: 'CANCELLED',
        oldStatus: currentOrder.status,
        newStatus: 'CANCELLED',
      },
    });

    // Audit log
    await audit({
      userId,
      action: 'ORDER_CANCELLED',
      resource: 'order',
      resourceId: orderId,
      metadata: {
        previousStatus: currentOrder.status,
        filledQuantity: currentOrder.filledQuantity,
      },
    });

    logger.info({ orderId }, 'Order cancelled successfully');

    return order;
  } catch (error) {
    // Re-throw ConcurrencyError for client handling
    if (error instanceof ConcurrencyError) {
      throw error;
    }
    // Log and re-throw unexpected errors
    logger.error({ orderId, error }, 'Unexpected error cancelling order');
    throw error;
  }
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<unknown> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      executions: {
        orderBy: { executedAt: 'desc' },
      },
      events: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return order;
}

/**
 * Get orders for an account
 */
export async function getOrders(params: {
  accountId: string;
  status?: string[];
  symbol?: string;
  limit?: number;
  offset?: number;
}): Promise<unknown> {
  const where: Prisma.OrderWhereInput = {
    accountId: params.accountId,
  };

  if (params.status && params.status.length > 0) {
    where.status = { in: params.status };
  }

  if (params.symbol) {
    where.symbol = params.symbol.toUpperCase();
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0,
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 5, // Include only recent executions
        },
      },
    }),
    db.order.count({ where }),
  ]);

  return {
    orders,
    total,
    limit: params.limit || 50,
    offset: params.offset || 0,
  };
}

/**
 * Get order history (events) for an order
 */
export async function getOrderHistory(orderId: string): Promise<unknown> {
  const events = await db.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  });

  return events;
 * Execute a market order immediately
 */
async function executeMarketOrder(
  order: any,
  tx: any
): Promise<any> {
  // Get current market price
  const price = await getCurrentPrice(order.symbol);

  if (!price) {
    // If no price available, reject the order
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'REJECTED',
        rejectionReason: 'No market price available',
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: 'REJECTED',
        oldStatus: order.status,
        newStatus: 'REJECTED',
        metadata: {
          reason: 'No market price available',
        },
      },
    });

    throw new InvalidOrderError('No market price available for symbol');
  }

  // Calculate commission (simulate $0 commission for paper trading)
  const commission = new Decimal(0);

  // Create execution
  const execution = await tx.execution.create({
    data: {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: new Decimal(price).toNumber(),
      commission: commission.toNumber(),
      executedAt: new Date(),
    },
  });

  // Update order to FILLED
  await tx.order.update({
    where: { id: order.id },
    data: {
      status: 'FILLED',
      filledQuantity: order.quantity,
      averagePrice: new Decimal(price).toNumber(),
    },
  });

  // Create FILLED event
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      eventType: 'FILLED',
      oldStatus: 'ACCEPTED',
      newStatus: 'FILLED',
      metadata: {
        executionId: execution.id,
        price,
        quantity: order.quantity,
      },
    },
  });

  // Update or create position
  await updatePosition({
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    quantity: order.quantity,
    price,
    tx,
  });

  return execution;
}

/**
 * Validate order parameters
 */
function validateOrderParams(params: {
  orderType: string;
  limitPrice?: number;
  stopPrice?: number;
  quantity: number;
}): void {
  const { orderType, limitPrice, stopPrice, quantity } = params;

  // Quantity must be positive
  if (quantity <= 0) {
    throw new ValidationError('Quantity must be positive');
  }

  // LIMIT orders require limit price
  if (orderType === 'LIMIT' && !limitPrice) {
    throw new ValidationError('Limit orders require a limit price');
  }

  // STOP orders require stop price
  if (orderType === 'STOP' && !stopPrice) {
    throw new ValidationError('Stop orders require a stop price');
  }

  // STOP_LIMIT orders require both
  if (orderType === 'STOP_LIMIT' && (!limitPrice || !stopPrice)) {
    throw new ValidationError('Stop limit orders require both limit and stop prices');
  }

  // Prices must be positive
  if (limitPrice && limitPrice <= 0) {
    throw new ValidationError('Limit price must be positive');
  }

  if (stopPrice && stopPrice <= 0) {
    throw new ValidationError('Stop price must be positive');
  }
}

/**
 * Estimate the cost of an order
 */
async function estimateOrderCost(params: {
  symbol: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
}): Promise<Decimal> {
  const { symbol, quantity, orderType, limitPrice } = params;

  let estimatedPrice: number;

  if (orderType === 'LIMIT' && limitPrice) {
    // Use limit price for limit orders
    estimatedPrice = limitPrice;
  } else {
    // Use current market price for market orders
    const currentPrice = await getCurrentPrice(symbol);
    if (!currentPrice) {
      throw new ValidationError('Cannot estimate order cost: no market price available');
    }
    estimatedPrice = currentPrice;
  }

  // Cost = quantity * price (no commission in paper trading)
  return new Decimal(quantity).times(estimatedPrice);
}

/**
 * Calculate buying power (cash available for trading)
 */
async function calculateBuyingPower(accountId: string): Promise<Decimal> {
  // Get account initial balance
  const account = await db.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new ValidationError('Account not found');
  }

  // Start with initial cash
  let cashBalance = new Decimal(account.initialCash.toString());

  // Get all executions for this account in a single query
  const executions = await db.execution.findMany({
    where: {
      order: {
        accountId,
      },
    },
    select: {
      side: true,
      quantity: true,
      price: true,
      commission: true,
    },
  });

  // Calculate net cash from all executions
  for (const exec of executions) {
    const amount = new Decimal(exec.price.toString()).times(exec.quantity);
    
    if (exec.side === 'BUY') {
      // Buying reduces cash (cost + commission)
      const cost = amount.plus(exec.commission.toString());
      cashBalance = cashBalance.minus(cost);
    } else {
      // Selling increases cash (proceeds - commission)
      const proceeds = amount.minus(exec.commission.toString());
      cashBalance = cashBalance.plus(proceeds);
    }
  }

  return cashBalance;
}

/**
 * Update position after execution
 */
async function updatePosition(params: {
  accountId: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  tx: any;
}): Promise<void> {
  const { accountId, symbol, side, quantity, price, tx } = params;

  const existingPosition = await tx.position.findUnique({
    where: {
      accountId_symbol: {
        accountId,
        symbol,
      },
    },
  });

  if (!existingPosition) {
    // Create new position
    if (side === 'BUY') {
      await tx.position.create({
        data: {
          accountId,
          symbol,
          quantity,
          averageCost: new Decimal(price).toNumber(),
          realizedPnL: 0,
        },
      });
    }
    // SELL without position should have been caught in validation
  } else {
    const currentQty = new Decimal(existingPosition.quantity);
    const currentCost = new Decimal(existingPosition.averageCost.toString());
    const executionPrice = new Decimal(price);
    const executionQty = new Decimal(quantity);

    if (side === 'BUY') {
      // Add to position
      const newQty = currentQty.plus(executionQty);
      const totalCost = currentQty.times(currentCost).plus(executionQty.times(executionPrice));
      const newAvgCost = totalCost.div(newQty);

      await tx.position.update({
        where: {
          accountId_symbol: {
            accountId,
            symbol,
          },
        },
        data: {
          quantity: newQty.toNumber(),
          averageCost: newAvgCost.toNumber(),
        },
      });
    } else {
      // Reduce position (SELL)
      const newQty = currentQty.minus(executionQty);

      // Calculate realized PnL
      const realizedPnL = executionQty.times(executionPrice.minus(currentCost));

      if (newQty.isZero()) {
        // Close position
        await tx.position.delete({
          where: {
            accountId_symbol: {
              accountId,
              symbol,
            },
          },
        });
      } else {
        // Update position
        await tx.position.update({
          where: {
            accountId_symbol: {
              accountId,
              symbol,
            },
          },
          data: {
            quantity: newQty.toNumber(),
            realizedPnL: new Decimal(existingPosition.realizedPnL.toString()).plus(realizedPnL).toNumber(),
          },
        });
      }
    }
  }
}
