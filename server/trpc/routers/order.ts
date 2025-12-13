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
        const idempotencyKey = input.idempotencyKey || `order-${ctx.userId}-${randomUUID()}`;

        const order = await orderService.placeOrder(
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
    }),
});
