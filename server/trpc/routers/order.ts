/**
 * Order Router
 * Order placement, modification, cancellation, and query endpoints
 */
import { router, protectedProcedure, accountProtectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../lib/db';
import { audit, AuditAction, AuditResource } from '../../lib/audit';
import {
  placeOrderSchema,
  orderStatusSchema,
  uuidSchema,
  paginationSchema,
} from '../../lib/schemas';
import { validateOrder, calculateOrderValue, checkBuyingPower } from '../../lib/order-validation';
import { simulateExecution } from '../../lib/execution-simulator';
import { ValidationError, InvalidOrderError, InsufficientFundsError } from '../../errors';
import { logger } from '../../lib/logger';
import crypto from 'node:crypto';

/**
 * List orders input schema
 */
const listOrdersSchema = z.object({
  accountId: uuidSchema,
  status: orderStatusSchema.optional(),
  symbol: z.string().min(1).max(10).optional(),
  ...paginationSchema.shape,
});

/**
 * Get order input schema
 */
const getOrderSchema = z.object({
  orderId: uuidSchema,
});

/**
 * Cancel order input schema
 */
const cancelOrderSchema = z.object({
  orderId: uuidSchema,
  reason: z.string().max(200).optional(),
});
 * tRPC endpoints for order management
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { router, accountProtectedProcedure, orderProtectedProcedure } from '../trpc';
import * as orderService from '../../lib/order-service';
import { placeOrderSchema, orderStatusSchema, uuidSchema } from '../../lib/schemas';
import { toTRPCError } from '../../lib/error-formatting';
 * tRPC routes for order management
 */
import { z } from 'zod';
import { router, accountProtectedProcedure } from '../trpc';
import { placeOrder } from '../../lib/order-service';
import { placeOrderSchema, uuidSchema } from '../../lib/schemas';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';
import crypto from 'crypto';

export const orderRouter = router({
  /**
   * Place a new order
   * Validates order, checks buying power, and simulates execution
   */
  place: accountProtectedProcedure
    .input(
      placeOrderSchema.extend({
        // Optional idempotency key - if not provided, we'll generate one
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accountId, symbol, side, quantity, orderType, limitPrice, stopPrice, timeInForce } =
        input;

      // Generate idempotency key if not provided
      const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

      // Check for existing order with same idempotency key
      const existingOrder = await db.order.findUnique({
        where: { idempotencyKey },
      });

      if (existingOrder) {
        logger.info(
          { orderId: existingOrder.id, idempotencyKey },
          'Returning existing order (idempotent)'
        );
        return existingOrder;
      }

      // Get account
      const account = await db.account.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        throw new ValidationError('Account not found');
      }

      if (account.status !== 'ACTIVE') {
        throw new ValidationError(`Account is ${account.status.toLowerCase()}`);
      }

      // Validate order parameters
      const validation = await validateOrder({
        symbol,
        side,
        quantity,
        orderType,
        limitPrice,
        stopPrice,
        timeInForce,
      });

      if (!validation.valid) {
        throw new InvalidOrderError(validation.reason || 'Invalid order parameters');
      }

      // Calculate order value
      const orderValue = await calculateOrderValue({
        symbol,
        side,
        quantity,
        orderType,
        limitPrice,
      });

      if (!orderValue) {
        throw new ValidationError(
          'Unable to calculate order value - symbol may not have current pricing'
        );
      }

      // Check buying power for BUY orders
      if (side === 'BUY') {
        const buyingPowerCheck = await checkBuyingPower(accountId, orderValue.estimatedCost);

        if (!buyingPowerCheck.sufficient) {
          throw new InsufficientFundsError(
            `Insufficient buying power. Required: $${orderValue.estimatedCost.toFixed(2)}, Available: $${buyingPowerCheck.available.toFixed(2)}`
          );
        }
      }

      // Create order
      const order = await db.order.create({
        data: {
          accountId,
          symbol,
          side,
          quantity,
          orderType,
          limitPrice,
          stopPrice,
          timeInForce,
          status: 'PENDING',
          idempotencyKey,
          filledQuantity: 0,
          version: 1,
          expiresAt: timeInForce === 'DAY' ? getEndOfDay() : null,
        },
      });

      // Log order creation event
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: 'CREATED',
          oldStatus: null,
          newStatus: 'PENDING',
          metadata: {
            symbol,
            side,
            quantity,
            orderType,
          },
        },
      });

      // Audit log
      await audit({
        actor: ctx.userId,
        action: AuditAction.ORDER_PLACED,
        resource: AuditResource.ORDER,
        resourceId: order.id,
        metadata: {
          accountId,
          symbol,
          side,
          quantity,
          orderType,
          estimatedValue: orderValue.estimatedCost,
        },
      });

      logger.info(
        {
          orderId: order.id,
          accountId,
          symbol,
          side,
          quantity,
          orderType,
        },
        'Order created'
      );

      // Simulate execution for market orders
      // (Limit orders would be queued for matching engine)
      if (orderType === 'MARKET') {
        // Trigger execution simulation asynchronously
        simulateExecution(order.id).catch((error) => {
          logger.error({ error, orderId: order.id }, 'Failed to simulate execution');
        });
      }

      return order;
      try {
        // Use provided idempotency key or generate a secure random one
        const idempotencyKey = input.idempotencyKey || `order-${randomUUID()}`;

        const order = await orderService.placeOrder(
    .input(placeOrderSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Use client-provided idempotency key or generate one
        const idempotencyKey = input.idempotencyKey || crypto.randomUUID();

        const result = await placeOrder(
          {
            accountId: input.accountId,
            symbol: input.symbol,
            side: input.side,
            quantity: input.quantity,
            orderType: input.orderType,
            limitPrice: input.limitPrice,
            stopPrice: input.stopPrice,
            timeInForce: input.timeInForce,
          },
          ctx.userId,
          idempotencyKey
        );

        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Modify an existing order
   */
  modify: orderProtectedProcedure
    .input(
      z.object({
        orderId: uuidSchema,
        quantity: z.number().int().positive().optional(),
        limitPrice: z.number().positive().optional(),
        stopPrice: z.number().positive().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const order = await orderService.modifyOrder(
          input.orderId,
          {
            quantity: input.quantity,
            limitPrice: input.limitPrice,
            stopPrice: input.stopPrice,
          },
          ctx.userId
        );

        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Cancel an order
   */
  cancel: orderProtectedProcedure
    .input(
      z.object({
        orderId: uuidSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const order = await orderService.cancelOrder(input.orderId, ctx.userId);
        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get a single order by ID
   */
  getById: orderProtectedProcedure
    .input(
      z.object({
        orderId: uuidSchema,
      })
    )
    .query(async ({ input }) => {
      try {
        const order = await orderService.getOrder(input.orderId);
        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
            userId: ctx.userId,
          },
          idempotencyKey
        );

        return result;
      } catch (error: any) {
        logger.error({ error, input }, 'Order placement failed');

        // Re-throw as tRPC error
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Failed to place order',
          cause: error,
        });
      }
    }),

  /**
   * Get order by ID
   */
  get: accountProtectedProcedure
    .input(
      z.object({
        orderId: uuidSchema,
        accountId: uuidSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      const { orderId, accountId } = input;

      const order = await ctx.db.order.findFirst({
        where: {
          id: orderId,
          accountId,
        },
        include: {
          executions: true,
          events: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      return {
        id: order.id,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        orderType: order.orderType,
        limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
        stopPrice: order.stopPrice ? Number(order.stopPrice) : null,
        status: order.status,
        filledQuantity: order.filledQuantity,
        averagePrice: order.averagePrice ? Number(order.averagePrice) : null,
        timeInForce: order.timeInForce,
        rejectionReason: order.rejectionReason,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        expiresAt: order.expiresAt,
        executions: order.executions.map((exec: any) => ({
          id: exec.id,
          symbol: exec.symbol,
          side: exec.side,
          quantity: exec.quantity,
          price: Number(exec.price),
          commission: Number(exec.commission),
          executedAt: exec.executedAt,
        })),
        events: order.events.map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          oldStatus: event.oldStatus,
          newStatus: event.newStatus,
          metadata: event.metadata,
          createdAt: event.createdAt,
        })),
      };
    }),

  /**
   * List orders for an account
   */
  list: accountProtectedProcedure.input(listOrdersSchema).query(async ({ input }) => {
    const { accountId, status, symbol, limit, offset } = input;

    const where: {
      accountId: string;
      status?: string;
      symbol?: string;
    } = {
      accountId,
    };

    if (status) {
      where.status = status;
    }

    if (symbol) {
      where.symbol = symbol.toUpperCase();
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      db.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }),

  /**
   * Get order by ID
   */
  get: protectedProcedure.input(getOrderSchema).query(async ({ input, ctx }) => {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        executions: {
          orderBy: {
            executedAt: 'asc',
          },
        },
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new ValidationError('Order not found');
    }

    // Authorization check
    if (order.account.ownerId !== ctx.userId) {
      throw new ValidationError('Access denied');
    }

    return order;
  }),

  /**
   * Cancel an order
   */
  cancel: protectedProcedure.input(cancelOrderSchema).mutation(async ({ input, ctx }) => {
    const { orderId, reason } = input;

    // Get order with account
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        account: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!order) {
      throw new ValidationError('Order not found');
    }

    // Authorization check
    if (order.account.ownerId !== ctx.userId) {
      throw new ValidationError('Access denied');
    }

    // Check if order can be cancelled
    if (!['PENDING', 'ACCEPTED', 'PARTIAL'].includes(order.status)) {
      throw new ValidationError(`Cannot cancel order with status ${order.status}`);
    }

    // Update order status
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date(),
      },
    });

    // Log cancellation event
    await db.orderEvent.create({
      data: {
        orderId,
        eventType: 'CANCELLED',
        oldStatus: order.status,
        newStatus: 'CANCELLED',
        metadata: {
          reason: reason || 'User requested',
          cancelledBy: ctx.userId,
        },
      },
    });

    // Audit log
    await audit({
      actor: ctx.userId,
      action: AuditAction.ORDER_CANCELLED,
      resource: AuditResource.ORDER,
      resourceId: orderId,
      metadata: {
        previousStatus: order.status,
        reason: reason || 'User requested',
      },
    });

    logger.info(
      {
        orderId,
        previousStatus: order.status,
        reason,
      },
      'Order cancelled'
    );

    return updatedOrder;
  }),

  /**
   * Get order history for an account
   */
  history: accountProtectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
        ...paginationSchema.shape,
      })
    )
    .query(async ({ input }) => {
      const { accountId, limit, offset } = input;

      const [orders, total] = await Promise.all([
        db.order.findMany({
          where: {
            accountId,
            status: {
              in: ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: limit,
          skip: offset,
          include: {
            executions: true,
          },
        }),
        db.order.count({
          where: {
            accountId,
            status: {
              in: ['FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
            },
          },
        }),
      ]);

      return {
        orders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    }),
});

/**
 * Helper function to get end of trading day
 * TODO: Replace with proper market hours service that accounts for:
 * - Different exchanges (NYSE, NASDAQ, etc.)
 * - Timezones (Eastern, Pacific, etc.)
 * - Holidays and early closes
 * - Pre-market and after-hours trading
 * Current implementation assumes 4 PM Eastern close (simplified)
 */
function getEndOfDay(): Date {
  const end = new Date();
  end.setHours(16, 0, 0, 0); // 4 PM Eastern (simplified)
  return end;
}
  list: accountProtectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
        status: z.array(orderStatusSchema).optional(),
        symbol: z.string().min(1).max(10).toUpperCase().optional(),
        status: z.enum(['PENDING', 'ACCEPTED', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED']).optional(),
        symbol: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await orderService.getOrders({
          accountId: input.accountId,
          status: input.status,
          symbol: input.symbol,
          limit: input.limit,
          offset: input.offset,
        });

        return result;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get order history (events)
   */
  getHistory: orderProtectedProcedure
    .input(
      z.object({
        orderId: uuidSchema,
      })
    )
    .query(async ({ input }) => {
      try {
        const events = await orderService.getOrderHistory(input.orderId);
        return events;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get open orders for an account
   */
  getOpen: accountProtectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
        symbol: z.string().min(1).max(10).toUpperCase().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await orderService.getOrders({
          accountId: input.accountId,
          status: ['PENDING', 'ACCEPTED', 'PARTIAL'],
          symbol: input.symbol,
          limit: 100,
          offset: 0,
        });

        return result.orders;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get recent filled orders for an account
   */
  getFilled: accountProtectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
        symbol: z.string().min(1).max(10).toUpperCase().optional(),
        limit: z.number().int().positive().max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await orderService.getOrders({
          accountId: input.accountId,
          status: ['FILLED'],
          symbol: input.symbol,
          limit: input.limit,
          offset: 0,
        });

        return result.orders;
      } catch (error) {
        throw toTRPCError(error);
      }
    .query(async ({ input, ctx }) => {
      const { accountId, status, symbol, limit, offset } = input;

      const where: any = {
        accountId,
      };

      if (status) {
        where.status = status;
      }

      if (symbol) {
        where.symbol = symbol.toUpperCase();
      }

      const [orders, total] = await Promise.all([
        ctx.db.order.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        ctx.db.order.count({ where }),
      ]);

      return {
        orders: orders.map((order: any) => ({
          id: order.id,
          accountId: order.accountId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          orderType: order.orderType,
          limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
          stopPrice: order.stopPrice ? Number(order.stopPrice) : null,
          status: order.status,
          filledQuantity: order.filledQuantity,
          averagePrice: order.averagePrice ? Number(order.averagePrice) : null,
          timeInForce: order.timeInForce,
          rejectionReason: order.rejectionReason,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        total,
        hasMore: offset + limit < total,
      };
    }),

  /**
   * Get open orders for an account
   */
  listOpen: accountProtectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
      })
    )
    .query(async ({ input, ctx }) => {
      const { accountId } = input;

      const orders = await ctx.db.order.findMany({
        where: {
          accountId,
          status: {
            in: ['PENDING', 'ACCEPTED', 'PARTIAL'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return orders.map((order: any) => ({
        id: order.id,
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        orderType: order.orderType,
        limitPrice: order.limitPrice ? Number(order.limitPrice) : null,
        stopPrice: order.stopPrice ? Number(order.stopPrice) : null,
        status: order.status,
        filledQuantity: order.filledQuantity,
        averagePrice: order.averagePrice ? Number(order.averagePrice) : null,
        timeInForce: order.timeInForce,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));
    }),
});
