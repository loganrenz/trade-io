/**
 * Order Validation Service
 * Validates order parameters and checks trading constraints
 */
import { db } from './db';
import { logger } from './logger';
import { canTradeInstrument } from './trading-hours';
import { getCurrentPrice, getMidPrice } from './pricing';

/**
 * Commission per trade for paper trading simulation
 * In production, this should be:
 * - Configurable per account type
 * - Based on broker commission schedules
 * - Include SEC fees, exchange fees, etc.
 * Set to $0 for paper trading to simplify calculations
 */
const COMMISSION_PER_TRADE = 0;

export interface OrderValidationParams {
 * Validates orders for symbol validity, quantity, buying power, and business rules
 */
import { db } from './db';
import { pricing } from './pricing';
import { tradingHours } from './trading-hours';
import {
  ValidationError,
  InvalidOrderError,
  InvalidSymbolError,
  InsufficientFundsError,
  MarketClosedError,
} from '../errors';
import Decimal from 'decimal.js';

/**
 * Validate an order before placement
 * Checks symbol, quantity, buying power, market hours, and business rules
 */
export async function validateOrder(params: {
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limitPrice?: number;
  stopPrice?: number;
  timeInForce: string;
}

export interface OrderValidationResult {
  valid: boolean;
  reason?: string;
}

export interface OrderValueResult {
  estimatedPrice: number;
  estimatedCost: number;
  commission: number;
}

export interface BuyingPowerCheck {
  sufficient: boolean;
  available: number;
  required: number;
}

/**
 * Validate order parameters
 */
export async function validateOrder(params: OrderValidationParams): Promise<OrderValidationResult> {
  const { symbol, quantity, orderType, limitPrice, stopPrice, timeInForce } = params;

  // Validate quantity
  if (quantity <= 0) {
    return { valid: false, reason: 'Quantity must be positive' };
  }

  // Validate order type specific params
  if (orderType === 'LIMIT' && !limitPrice) {
    return { valid: false, reason: 'Limit price required for LIMIT orders' };
  }

  if (orderType === 'STOP' && !stopPrice) {
    return { valid: false, reason: 'Stop price required for STOP orders' };
  }

  if (orderType === 'STOP_LIMIT' && (!limitPrice || !stopPrice)) {
    return { valid: false, reason: 'Both limit and stop prices required for STOP_LIMIT orders' };
  }

  // Validate prices are positive
  if (limitPrice && limitPrice <= 0) {
    return { valid: false, reason: 'Limit price must be positive' };
  }

  if (stopPrice && stopPrice <= 0) {
    return { valid: false, reason: 'Stop price must be positive' };
  }

  // Check if instrument exists and is tradeable
  const instrument = await db.instrument.findFirst({
    where: {
      symbol,
      isActive: true,
    },
  });

  if (!instrument) {
    return { valid: false, reason: `Symbol ${symbol} not found` };
  }

  if (!instrument.isTradeable) {
    return { valid: false, reason: `Symbol ${symbol} is not tradeable` };
  }

  // Check trading hours for market orders
  if (orderType === 'MARKET') {
    const canTrade = await canTradeInstrument(symbol);
    if (!canTrade) {
      return { valid: false, reason: 'Market is closed for this instrument' };
    }
  }

  // Validate time in force for order type
  if (orderType === 'MARKET' && timeInForce === 'GTC') {
    return { valid: false, reason: 'MARKET orders cannot be GTC (Good Till Cancel)' };
  }

  // Check for symbol restrictions
  const restriction = await db.symbolRestriction.findFirst({
    where: {
      symbol,
      isActive: true,
    },
  });

  if (restriction) {
    return { valid: false, reason: `Trading is restricted for ${symbol}` };
  }

  return { valid: true };
}

/**
 * Calculate estimated order value
 */
export async function calculateOrderValue(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  limitPrice?: number;
}): Promise<OrderValueResult | null> {
  const { symbol, quantity, orderType, limitPrice } = params;

  let estimatedPrice: number | null = null;

  // Determine estimated price
  if (orderType === 'LIMIT' && limitPrice) {
    estimatedPrice = limitPrice;
  } else {
    // For market orders, use current price
    estimatedPrice = await getCurrentPrice(symbol);

    // If no current price, try mid price
    if (!estimatedPrice) {
      estimatedPrice = await getMidPrice(symbol);
    }
  }

  if (!estimatedPrice) {
    logger.warn({ symbol }, 'Unable to determine price for order value calculation');
    return null;
  }

  // Calculate commission
  const commission = COMMISSION_PER_TRADE;

  // Calculate total cost
  const estimatedCost = estimatedPrice * quantity + commission;

  return {
    estimatedPrice,
    estimatedCost,
    commission,
  };
}

/**
 * Check if account has sufficient buying power
 */
export async function checkBuyingPower(
  accountId: string,
  requiredAmount: number
): Promise<BuyingPowerCheck> {
  // Get account initial cash
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: {
      initialCash: true,
    },
  });

  if (!account) {
    return {
      sufficient: false,
      available: 0,
      required: requiredAmount,
    };
  }

  // Calculate available cash
  // Start with initial cash
  let availableCash = Number(account.initialCash);

  // Subtract pending order values (orders that will use buying power)
  const pendingOrders = await db.order.findMany({
    where: {
      accountId,
      status: {
        in: ['PENDING', 'ACCEPTED', 'PARTIAL'],
      },
      side: 'BUY',
    },
    include: {
      executions: true,
    },
  });

  // Calculate value of pending buy orders
  for (const order of pendingOrders) {
    const remainingQuantity = order.quantity - order.filledQuantity;

    if (remainingQuantity > 0) {
      let estimatedPrice: number;

      if (order.orderType === 'LIMIT' && order.limitPrice) {
        estimatedPrice = Number(order.limitPrice);
      } else {
        const currentPrice = await getCurrentPrice(order.symbol);
        estimatedPrice = currentPrice || Number(order.limitPrice) || 0;
      }

      availableCash -= estimatedPrice * remainingQuantity;
    }
  }

  // Add value from ledger entries (deposits, withdrawals, trades)
  const ledgerEntries = await db.ledgerEntry.findMany({
    where: {
      accountId,
    },
  });

  // Sum all ledger cash movements
  const ledgerBalance = ledgerEntries.reduce((sum, entry) => sum + Number(entry.cashAmount), 0);

  availableCash += ledgerBalance;

  return {
    sufficient: availableCash >= requiredAmount,
    available: availableCash,
    required: requiredAmount,
  };
}

/**
 * Validate position limits
 */
export async function checkPositionLimits(
  accountId: string,
  symbol: string,
  quantity: number,
  side: 'BUY' | 'SELL'
): Promise<{ allowed: boolean; reason?: string }> {
  // Get current position
  const position = await db.position.findFirst({
    where: {
      accountId,
      symbol,
    },
  });

  const currentQuantity = position?.quantity || 0;
  const newQuantity = side === 'BUY' ? currentQuantity + quantity : currentQuantity - quantity;

  // Check risk limits
  const riskLimit = await db.riskLimit.findFirst({
    where: {
      OR: [
        { accountId },
        { accountId: null }, // Global limits
      ],
    },
    orderBy: {
      accountId: 'desc', // Account-specific limits take precedence
    },
  });

  if (riskLimit && riskLimit.maxPositionSize) {
    const maxPositionSize = Number(riskLimit.maxPositionSize);

    if (Math.abs(newQuantity) > maxPositionSize) {
      return {
        allowed: false,
        reason: `Position would exceed maximum position size of ${maxPositionSize} shares`,
      };
    }
  }

  return { allowed: true };
}): Promise<void> {
  // Validate symbol exists and is tradeable
  await validateSymbol(params.symbol);

  // Validate quantity
  validateQuantity(params.quantity);

  // Validate price parameters
  validatePriceParameters(params.orderType, params.limitPrice, params.stopPrice);

  // Validate market hours (for market orders and DAY orders)
  if (params.orderType === 'MARKET' || params.timeInForce === 'DAY') {
    await validateMarketHours(params.symbol);
  }

  // Validate buying power for BUY orders
  if (params.side === 'BUY') {
    await validateBuyingPower(params);
  }

  // Validate position exists for SELL orders
  if (params.side === 'SELL') {
    await validateSellPosition(params.accountId, params.symbol, params.quantity);
  }
}

/**
 * Validate symbol exists and is tradeable
 */
export async function validateSymbol(symbol: string): Promise<void> {
  const instrument = await db.instrument.findUnique({
    where: { symbol },
  });

  if (!instrument) {
    throw new InvalidSymbolError(`Symbol ${symbol} not found`);
  }

  if (!instrument.isActive) {
    throw new InvalidSymbolError(`Symbol ${symbol} is not active`);
  }

  if (!instrument.isTradeable) {
    throw new InvalidSymbolError(`Symbol ${symbol} is not tradeable`);
  }
}

/**
 * Validate quantity is positive integer
 */
export function validateQuantity(quantity: number): void {
  if (!Number.isInteger(quantity)) {
    throw new ValidationError('Quantity must be an integer', 'quantity');
  }

  if (quantity <= 0) {
    throw new ValidationError('Quantity must be positive', 'quantity');
  }

  if (quantity > 1000000) {
    throw new ValidationError('Quantity exceeds maximum allowed (1,000,000)', 'quantity');
  }
}

/**
 * Validate price parameters based on order type
 */
export function validatePriceParameters(
  orderType: string,
  limitPrice?: number,
  stopPrice?: number
): void {
  if (orderType === 'LIMIT' || orderType === 'STOP_LIMIT') {
    if (!limitPrice || limitPrice <= 0) {
      throw new ValidationError('Limit price is required and must be positive', 'limitPrice');
    }
  }

  if (orderType === 'STOP' || orderType === 'STOP_LIMIT') {
    if (!stopPrice || stopPrice <= 0) {
      throw new ValidationError('Stop price is required and must be positive', 'stopPrice');
    }
  }

  if (orderType === 'MARKET') {
    if (limitPrice !== undefined) {
      throw new ValidationError('Market orders cannot have a limit price', 'limitPrice');
    }
    if (stopPrice !== undefined) {
      throw new ValidationError('Market orders cannot have a stop price', 'stopPrice');
    }
  }

  // Validate STOP_LIMIT has both prices
  if (orderType === 'STOP_LIMIT') {
    if (!limitPrice || !stopPrice) {
      throw new ValidationError(
        'Stop-limit orders require both limit price and stop price',
        'limitPrice'
      );
    }
  }
}

/**
 * Validate market is open for trading
 */
export async function validateMarketHours(symbol: string): Promise<void> {
  const isOpen = await tradingHours.isMarketOpen(symbol);

  if (!isOpen) {
    const nextOpen = await tradingHours.getNextMarketOpen(symbol);
    throw new MarketClosedError(
      `Market is closed for ${symbol}. Next open: ${nextOpen?.toISOString()}`
    );
  }
}

/**
 * Validate account has sufficient buying power for BUY order
 */
export async function validateBuyingPower(params: {
  accountId: string;
  symbol: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
}): Promise<void> {
  // Get account
  const account = await db.account.findUnique({
    where: { id: params.accountId },
  });

  if (!account) {
    throw new ValidationError('Account not found', 'accountId');
  }

  // Calculate cash balance
  const cashBalance = await calculateCashBalance(params.accountId);

  // Estimate order cost
  const estimatedCost = await estimateOrderCost(params);

  // Check if sufficient funds
  if (cashBalance.lessThan(estimatedCost)) {
    throw new InsufficientFundsError(
      `Insufficient funds. Required: $${estimatedCost.toFixed(2)}, Available: $${cashBalance.toFixed(2)}`
    );
  }
}

/**
 * Calculate current cash balance for account
 */
export async function calculateCashBalance(accountId: string): Promise<Decimal> {
  const account = await db.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new ValidationError('Account not found', 'accountId');
  }

  // Get latest ledger entry balance
  const latestEntry = await db.ledgerEntry.findFirst({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });

  if (latestEntry) {
    return new Decimal(latestEntry.balanceAfter.toString());
  }

  // No ledger entries yet, return initial cash
  return new Decimal(account.initialCash.toString());
}

/**
 * Estimate the cost of an order
 */
export async function estimateOrderCost(params: {
  symbol: string;
  quantity: number;
  orderType: string;
  limitPrice?: number;
}): Promise<Decimal> {
  let estimatedPrice: number;

  if (params.orderType === 'LIMIT' && params.limitPrice) {
    // Use limit price for LIMIT orders
    estimatedPrice = params.limitPrice;
  } else {
    // Get current market price for MARKET orders
    const currentPrice = await pricing.getCurrentPrice(params.symbol);
    estimatedPrice = currentPrice;
  }

  // Calculate cost with 5% buffer for market orders (slippage protection)
  const basePrice = new Decimal(estimatedPrice);
  const quantity = new Decimal(params.quantity);
  const cost = basePrice.times(quantity);

  // Add buffer for market orders
  if (params.orderType === 'MARKET') {
    return cost.times(1.05); // 5% buffer
  }

  return cost;
}

/**
 * Validate position exists and has sufficient quantity for SELL order
 */
export async function validateSellPosition(
  accountId: string,
  symbol: string,
  quantity: number
): Promise<void> {
  const position = await db.position.findUnique({
    where: {
      accountId_symbol: {
        accountId,
        symbol,
      },
    },
  });

  if (!position) {
    throw new InvalidOrderError(`No position found for ${symbol}. Cannot sell.`);
  }

  if (position.quantity < quantity) {
    throw new InvalidOrderError(
      `Insufficient shares. Position: ${position.quantity}, Requested: ${quantity}`
    );
  }

  if (position.quantity === 0) {
    throw new InvalidOrderError(`Position for ${symbol} has zero quantity. Cannot sell.`);
  }
}

/**
 * Validate order modification
 */
export async function validateOrderModification(params: {
  orderId: string;
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
}): Promise<void> {
  // Get existing order
  const order = await db.order.findUnique({
    where: { id: params.orderId },
  });

  if (!order) {
    throw new ValidationError('Order not found', 'orderId');
  }

  // Can only modify orders in PENDING or ACCEPTED status
  if (!['PENDING', 'ACCEPTED'].includes(order.status)) {
    throw new InvalidOrderError(
      `Cannot modify order in ${order.status} status. Only PENDING or ACCEPTED orders can be modified.`
    );
  }

  // Validate new quantity if provided
  if (params.quantity !== undefined) {
    validateQuantity(params.quantity);

    // For partially filled orders, new quantity must be >= filled quantity
    if (order.filledQuantity > 0 && params.quantity < order.filledQuantity) {
      throw new InvalidOrderError(
        `New quantity (${params.quantity}) cannot be less than filled quantity (${order.filledQuantity})`
      );
    }
  }

  // Validate new prices
  if (params.limitPrice !== undefined && params.limitPrice <= 0) {
    throw new ValidationError('Limit price must be positive', 'limitPrice');
  }

  if (params.stopPrice !== undefined && params.stopPrice <= 0) {
    throw new ValidationError('Stop price must be positive', 'stopPrice');
  }
}

/**
 * Validate order cancellation
 */
export async function validateOrderCancellation(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new ValidationError('Order not found', 'orderId');
  }

  // Can only cancel orders in PENDING, ACCEPTED, or PARTIAL status
  if (!['PENDING', 'ACCEPTED', 'PARTIAL'].includes(order.status)) {
    throw new InvalidOrderError(
      `Cannot cancel order in ${order.status} status. Only PENDING, ACCEPTED, or PARTIAL orders can be cancelled.`
    );
  }
}
