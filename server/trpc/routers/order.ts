/**
 * Order Router
 * tRPC router for order management operations
 */
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import * as orderService from '../../lib/order-service';
import {
  placeOrderSchema,
  orderStatusSchema,
  uuidSchema,
  paginationSchema,
} from '../../lib/schemas';
import { toTRPCError } from '../../lib/error-formatting';
import { randomUUID } from 'node:crypto';
import { checkAccountAccess, checkOrderAccess } from '../../lib/authz';

export const orderRouter = router({
  /**
   * Place a new order
   */
  place: protectedProcedure
    .input(
      placeOrderSchema.extend({
        idempotencyKey: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const idempotencyKey = input.idempotencyKey || `order-${randomUUID()}`;
        const order = await orderService.placeOrder(
          {
            accountId: input.accountId,
            symbol: input.symbol,
            side: input.side,
            quantity: input.quantity,
            orderType: input.orderType,
            limitPrice: input.limitPrice,
            stopPrice: input.stopPrice,
            timeInForce: input.timeInForce || 'DAY',
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
  modify: protectedProcedure
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
        // Check authorization
        await checkOrderAccess(ctx.userId!, input.orderId);
        const order = await orderService.modifyOrder(
          input.orderId,
          {
            quantity: input.quantity,
            limitPrice: input.limitPrice,
            stopPrice: input.stopPrice,
          },
          ctx.userId!
        );
        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Cancel an order
   */
  cancel: protectedProcedure
    .input(z.object({ 
      orderId: uuidSchema,
      reason: z.string().max(200).optional(), // Optional reason for cancellation
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Check authorization
        await checkOrderAccess(ctx.userId!, input.orderId);
        const order = await orderService.cancelOrder(input.orderId, ctx.userId!);
        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get a single order by ID
   */
  get: protectedProcedure
    .input(z.object({ orderId: uuidSchema }))
    .query(async ({ input, ctx }) => {
      try {
        // Check authorization
        await checkOrderAccess(ctx.userId!, input.orderId);
        const order = await orderService.getOrder(input.orderId);
        return order;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * List orders for an account
   */
  list: protectedProcedure
    .input(
      z.object({
        accountId: uuidSchema,
        status: orderStatusSchema.optional(),
        symbol: z.string().min(1).max(10).optional(),
        ...paginationSchema.shape,
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Check authorization
        await checkAccountAccess(ctx.userId!, input.accountId);
        const orders = await orderService.getOrders({
          accountId: input.accountId,
          status: input.status,
          symbol: input.symbol,
          page: Math.floor(input.offset / input.limit) + 1,
          perPage: input.limit,
        });
        return orders;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),

  /**
   * Get order history (events)
   */
  history: protectedProcedure
    .input(z.object({ orderId: uuidSchema }))
    .query(async ({ input, ctx }) => {
      try {
        // Check authorization
        await checkOrderAccess(ctx.userId!, input.orderId);
        const events = await orderService.getOrderHistory(input.orderId);
        return events;
      } catch (error) {
        throw toTRPCError(error);
      }
    }),
});
