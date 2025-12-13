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
    if (error instanceof ConcurrencyError) {
      throw error;
    }
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
    if (error instanceof ConcurrencyError) {
      throw error;
    }
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
}
