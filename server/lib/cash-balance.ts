/**
 * Cash Balance Service
 *
 * Provides functions for calculating cash balances and buying power
 * based on the double-entry ledger system.
 */

import { getLedgerAccountBalance, getAllLedgerAccountBalances } from './ledger-service';
import Decimal from 'decimal.js';
import { db } from './db';

/**
 * Get current cash balance for an account
 */
export async function getCashBalance(accountId: string): Promise<Decimal> {
  return await getLedgerAccountBalance(accountId, 'Cash');
}

/**
 * Get current securities value from ledger
 * This represents the cost basis of all holdings, not market value
 */
export async function getSecuritiesValue(accountId: string): Promise<Decimal> {
  return await getLedgerAccountBalance(accountId, 'Securities');
}

/**
 * Get buying power for an account
 *
 * For CASH accounts: buying power = cash balance
 * For MARGIN accounts (future): buying power = cash + margin available
 */
export async function getBuyingPower(accountId: string): Promise<Decimal> {
  // Get account type
  const account = await db.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const cashBalance = await getCashBalance(accountId);

  // For now, only CASH accounts are supported
  // Buying power = cash balance (no margin)
  if (account.type === 'INDIVIDUAL' || account.type === 'CASH') {
    return cashBalance;
  }

  // Future: Add margin account logic
  // if (account.type === 'MARGIN') {
  //   const marginAvailable = await getMarginAvailable(accountId);
  //   return cashBalance.plus(marginAvailable);
  // }

  return cashBalance;
}

/**
 * Check if account has sufficient buying power for a purchase
 */
export async function hasSufficientBuyingPower(
  accountId: string,
  requiredAmount: number | string | Decimal
): Promise<boolean> {
  const buyingPower = await getBuyingPower(accountId);
  const required = new Decimal(requiredAmount);

  return buyingPower.greaterThanOrEqualTo(required);
}

/**
 * Calculate available cash after pending orders
 *
 * This considers pending BUY orders that will consume cash when executed
 */
export async function getAvailableCash(accountId: string): Promise<Decimal> {
  const cashBalance = await getCashBalance(accountId);

  // Get pending BUY orders
  const pendingOrders = await db.order.findMany({
    where: {
      accountId,
      side: 'BUY',
      status: {
        in: ['PENDING', 'ACCEPTED', 'PARTIAL'],
      },
    },
  });

  // Calculate reserved cash (sum of pending BUY orders)
  let reservedCash = new Decimal(0);

  for (const order of pendingOrders) {
    const remainingQuantity = order.quantity - order.filledQuantity;

    if (order.orderType === 'MARKET') {
      // For market orders, we don't know the exact price
      // Use a conservative estimate (last known price + buffer)
      // For now, skip market orders or use limit price if available
      continue;
    } else if (order.orderType === 'LIMIT' && order.limitPrice) {
      const orderValue = new Decimal(remainingQuantity).times(new Decimal(order.limitPrice));
      reservedCash = reservedCash.plus(orderValue);
    }
  }

  return cashBalance.minus(reservedCash);
}

/**
 * Get account balance summary
 */
export interface AccountBalanceSummary {
  cashBalance: string;
  securitiesValue: string;
  totalAssets: string;
  buyingPower: string;
  availableCash: string;
  reservedCash: string;
}

export async function getAccountBalanceSummary(
  accountId: string
): Promise<AccountBalanceSummary> {
  const [cashBalance, securitiesValue, buyingPower, availableCash] = await Promise.all([
    getCashBalance(accountId),
    getSecuritiesValue(accountId),
    getBuyingPower(accountId),
    getAvailableCash(accountId),
  ]);

  const totalAssets = cashBalance.plus(securitiesValue);
  const reservedCash = cashBalance.minus(availableCash);

  return {
    cashBalance: cashBalance.toFixed(2),
    securitiesValue: securitiesValue.toFixed(2),
    totalAssets: totalAssets.toFixed(2),
    buyingPower: buyingPower.toFixed(2),
    availableCash: availableCash.toFixed(2),
    reservedCash: reservedCash.toFixed(2),
  };
}

/**
 * Get detailed ledger account breakdown
 */
export interface LedgerAccountBreakdown {
  accountType: string;
  accountName: string;
  balance: string;
}

export async function getLedgerAccountBreakdown(
  accountId: string
): Promise<LedgerAccountBreakdown[]> {
  const accounts = await getAllLedgerAccountBalances(accountId);

  return accounts.map((acc) => ({
    accountType: acc.accountType,
    accountName: acc.accountName,
    balance: acc.balance.toFixed(2),
  }));
}
