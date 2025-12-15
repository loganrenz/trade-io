/**
 * Order Router
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
   */
  place: accountProtectedProcedure
    .input(
      placeOrderSchema.extend({
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
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
