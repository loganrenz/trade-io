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
}
