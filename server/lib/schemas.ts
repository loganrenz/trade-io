/**
 * Shared Validation Schemas
 * Centralized Zod schemas for common data types
 */
import { z } from 'zod';

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid();

/**
 * Email validation
 */
export const emailSchema = z.string().email();

/**
 * Pagination schemas
 */
export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

export const cursorPaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});

/**
 * Date range schemas
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

/**
 * Order schemas
 */
export const orderSideSchema = z.enum(['BUY', 'SELL']);

export const orderTypeSchema = z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']);

export const timeInForceSchema = z.enum(['DAY', 'GTC', 'IOC', 'FOK']);

export const orderStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'PARTIAL',
  'FILLED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
]);

export const placeOrderSchema = z.object({
  accountId: uuidSchema,
  symbol: z.string().min(1).max(10).toUpperCase(),
  side: orderSideSchema,
  quantity: z.number().int().positive(),
  orderType: orderTypeSchema,
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: timeInForceSchema.default('DAY'),
  idempotencyKey: z.string().optional(), // Client-provided idempotency key
});

/**
 * Account schemas
 */
export const accountTypeSchema = z.enum(['INDIVIDUAL', 'JOINT', 'MARGIN']);

export const accountStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']);

/**
 * Instrument schemas
 */
export const instrumentTypeSchema = z.enum(['STOCK', 'ETF', 'OPTION', 'CRYPTO']);

export const instrumentSearchSchema = z.object({
  query: z.string().min(1).max(100),
  type: instrumentTypeSchema.optional(),
  exchange: z.string().max(20).optional(),
  limit: z.number().int().positive().max(50).default(10),
});

/**
 * Market data schemas
 */
export const timeframeSchema = z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

export const quoteSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  bid: z.number().positive().optional(),
  ask: z.number().positive().optional(),
  last: z.number().positive(),
  volume: z.number().int().nonnegative().optional(),
  timestamp: z.coerce.date(),
});

export const barSchema = z.object({
  symbol: z.string().min(1).max(10).toUpperCase(),
  timeframe: timeframeSchema,
  timestamp: z.coerce.date(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().int().nonnegative(),
});

/**
 * Risk limit schemas
 */
export const riskLimitSchema = z.object({
  accountId: uuidSchema.optional(),
  maxPositionSize: z.number().positive().optional(),
  maxOrderValue: z.number().positive().optional(),
  maxDailyLoss: z.number().positive().optional(),
  maxOpenOrders: z.number().int().positive().optional(),
});
