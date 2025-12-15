/**
 * Ledger Service - Double-Entry Bookkeeping
 *
 * Implements proper double-entry accounting for all financial transactions.
 * Every transaction must have equal debits and credits.
 *
 * Account Types (DEALER - Debit increases / Credit decreases):
 * - ASSET: Cash, Securities (Debit increases)
 * - EXPENSE: Commissions, Fees (Debit increases)
 *
 * Account Types (CREDIT - Credit increases / Debit decreases):
 * - LIABILITY: Margin debt (Credit increases)
 * - EQUITY: Initial capital (Credit increases)
 * - REVENUE: Dividends, Interest (Credit increases)
 */

import { db } from './db';
import { logger } from './logger';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';

/**
 * Ledger account subtypes
 */
export const LEDGER_ACCOUNT_SUBTYPES = {
  // Assets
  CASH: 'CASH',
  SECURITIES: 'SECURITIES',

  // Equity
  INITIAL_CAPITAL: 'INITIAL_CAPITAL',
  RETAINED_EARNINGS: 'RETAINED_EARNINGS',

  // Revenue
  REALIZED_GAINS: 'REALIZED_GAINS',
  DIVIDENDS: 'DIVIDENDS',
  INTEREST: 'INTEREST',

  // Expenses
  COMMISSION: 'COMMISSION',
  FEES: 'FEES',
  REALIZED_LOSSES: 'REALIZED_LOSSES',
} as const;

/**
 * Entry type for double-entry bookkeeping
 */
export type EntryType = 'DEBIT' | 'CREDIT';

/**
 * Reference types for ledger entries
 */
export type ReferenceType =
  | 'EXECUTION'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'DIVIDEND'
  | 'FEE'
  | 'ADJUSTMENT'
  | 'INITIAL';

/**
 * Double-entry transaction input
 */
export interface LedgerTransaction {
  accountId: string;
  description: string;
  referenceType: ReferenceType;
  referenceId?: string;
  entries: LedgerTransactionEntry[];
}

/**
 * Individual entry in a double-entry transaction
 */
export interface LedgerTransactionEntry {
  ledgerAccountSubtype: string;
  entryType: EntryType;
  amount: number | string | Decimal;
  metadata?: Record<string, unknown>;
}

/**
 * Ledger account with balance
 */
export interface LedgerAccountWithBalance {
  id: string;
  accountId: string;
  accountType: string;
  accountName: string;
  balance: Decimal;
}

/**
 * Initialize ledger accounts for a trading account
 *
 * Creates the standard chart of accounts:
 * - ASSET:CASH - Cash balance
 * - ASSET:SECURITIES - Market value of holdings
 * - EQUITY:INITIAL_CAPITAL - Initial deposit
 * - EXPENSE:COMMISSION - Trading commissions
 * - EXPENSE:FEES - Other fees
 */
export async function initializeLedgerAccounts(
  accountId: string,
  initialCash: number | Decimal
): Promise<void> {
  logger.info({ accountId, initialCash }, 'Initializing ledger accounts');

  // Check if already initialized
  const existing = await db.ledgerAccount.findFirst({
    where: { accountId },
  });

  if (existing) {
    logger.warn({ accountId }, 'Ledger accounts already initialized');
    return;
  }

  // Create standard chart of accounts
  const ledgerAccounts = [
    {
      accountId,
      accountType: 'ASSET',
      accountName: 'Cash',
      balance: 0,
    },
    {
      accountId,
      accountType: 'ASSET',
      accountName: 'Securities',
      balance: 0,
    },
    {
      accountId,
      accountType: 'EQUITY',
      accountName: 'Initial Capital',
      balance: 0,
    },
    {
      accountId,
      accountType: 'EXPENSE',
      accountName: 'Commission',
      balance: 0,
    },
    {
      accountId,
      accountType: 'EXPENSE',
      accountName: 'Fees',
      balance: 0,
    },
    {
      accountId,
      accountType: 'REVENUE',
      accountName: 'Realized Gains',
      balance: 0,
    },
    {
      accountId,
      accountType: 'EXPENSE',
      accountName: 'Realized Losses',
      balance: 0,
    },
  ];

  // Create accounts in transaction
  await db.$transaction(async (tx) => {
    for (const account of ledgerAccounts) {
      await tx.ledgerAccount.create({
        data: account,
      });
    }
  });

  // Record initial deposit if non-zero
  if (new Decimal(initialCash).greaterThan(0)) {
    await recordTransaction({
      accountId,
      description: `Initial deposit of $${new Decimal(initialCash).toFixed(2)}`,
      referenceType: 'INITIAL',
      entries: [
        {
          ledgerAccountSubtype: 'CASH',
          entryType: 'DEBIT',
          amount: initialCash,
        },
        {
          ledgerAccountSubtype: 'INITIAL_CAPITAL',
          entryType: 'CREDIT',
          amount: initialCash,
        },
      ],
    });
  }

  logger.info({ accountId }, 'Ledger accounts initialized successfully');
}

/**
 * Record a double-entry transaction
 *
 * Validates that debits equal credits, then creates all ledger entries
 * atomically in a database transaction.
 */
export async function recordTransaction(transaction: LedgerTransaction): Promise<string> {
  const { accountId, description, referenceType, referenceId, entries } = transaction;

  // Generate transaction ID
  const transactionId = randomUUID();

  // Validate: debits must equal credits
  let totalDebits = new Decimal(0);
  let totalCredits = new Decimal(0);

  for (const entry of entries) {
    const amount = new Decimal(entry.amount);

    if (amount.lessThanOrEqualTo(0)) {
      throw new Error(`Invalid amount: ${amount}. All amounts must be positive.`);
    }

    if (entry.entryType === 'DEBIT') {
      totalDebits = totalDebits.plus(amount);
    } else {
      totalCredits = totalCredits.plus(amount);
    }
  }

  if (!totalDebits.equals(totalCredits)) {
    throw new Error(
      `Transaction not balanced: debits=${totalDebits.toString()}, credits=${totalCredits.toString()}`
    );
  }

  // Get ledger accounts for this account
  const ledgerAccounts = await db.ledgerAccount.findMany({
    where: { accountId },
  });

  const ledgerAccountMap = new Map(
    ledgerAccounts.map((acc) => [acc.accountName.toLowerCase().replace(/\s+/g, '_'), acc])
  );

  // Create all ledger entries in a transaction
  await db.$transaction(async (tx) => {
    for (const entry of entries) {
      // Find the ledger account
      const ledgerAccount = ledgerAccountMap.get(entry.ledgerAccountSubtype.toLowerCase());

      if (!ledgerAccount) {
        throw new Error(
          `Ledger account not found: ${entry.ledgerAccountSubtype} for account ${accountId}`
        );
      }

      const amount = new Decimal(entry.amount);

      // Calculate new balance based on account type and entry type
      const currentBalance = new Decimal(ledgerAccount.balance);
      let newBalance: Decimal;

      // DEALER accounts (ASSET, EXPENSE): Debit increases, Credit decreases
      if (ledgerAccount.accountType === 'ASSET' || ledgerAccount.accountType === 'EXPENSE') {
        newBalance =
          entry.entryType === 'DEBIT' ? currentBalance.plus(amount) : currentBalance.minus(amount);
      }
      // CREDIT accounts (LIABILITY, EQUITY, REVENUE): Credit increases, Debit decreases
      else {
        newBalance =
          entry.entryType === 'CREDIT' ? currentBalance.plus(amount) : currentBalance.minus(amount);
      }

      // Update ledger account balance
      await tx.ledgerAccount.update({
        where: { id: ledgerAccount.id },
        data: { balance: newBalance.toNumber() },
      });

      // Create ledger entry (using old schema format for now)
      await tx.ledgerEntry.create({
        data: {
          accountId,
          entryType: entry.entryType,
          symbol: null,
          quantity: null,
          cashAmount: entry.entryType === 'DEBIT' ? amount.toNumber() : -amount.toNumber(),
          balanceAfter: newBalance.toNumber(),
          description: `${description} (${entry.ledgerAccountSubtype} - ${entry.entryType})`,
          referenceId: referenceId || null,
        },
      });
    }
  });

  logger.info(
    {
      accountId,
      transactionId,
      description,
      referenceType,
      debits: totalDebits.toString(),
      credits: totalCredits.toString(),
    },
    'Transaction recorded'
  );

  return transactionId;
}

/**
 * Get current balance for a specific ledger account type
 */
export async function getLedgerAccountBalance(
  accountId: string,
  accountName: string
): Promise<Decimal> {
  const ledgerAccount = await db.ledgerAccount.findFirst({
    where: {
      accountId,
      accountName: {
        equals: accountName,
        mode: 'insensitive',
      },
    },
  });

  if (!ledgerAccount) {
    return new Decimal(0);
  }

  return new Decimal(ledgerAccount.balance);
}

/**
 * Get all ledger account balances for an account
 */
export async function getAllLedgerAccountBalances(
  accountId: string
): Promise<LedgerAccountWithBalance[]> {
  const ledgerAccounts = await db.ledgerAccount.findMany({
    where: { accountId },
    orderBy: { accountType: 'asc' },
  });

  return ledgerAccounts.map((acc) => ({
    ...acc,
    balance: new Decimal(acc.balance),
  }));
}

/**
 * Calculate total assets (cash + securities)
 */
export async function getTotalAssets(accountId: string): Promise<Decimal> {
  const accounts = await db.ledgerAccount.findMany({
    where: {
      accountId,
      accountType: 'ASSET',
    },
  });

  return accounts.reduce((sum, acc) => sum.plus(new Decimal(acc.balance)), new Decimal(0));
}

/**
 * Calculate total equity (assets - liabilities)
 */
export async function getTotalEquity(accountId: string): Promise<Decimal> {
  const [assets, liabilities] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { accountId, accountType: 'ASSET' },
    }),
    db.ledgerAccount.findMany({
      where: { accountId, accountType: 'LIABILITY' },
    }),
  ]);

  const totalAssets = assets.reduce(
    (sum, acc) => sum.plus(new Decimal(acc.balance)),
    new Decimal(0)
  );

  const totalLiabilities = liabilities.reduce(
    (sum, acc) => sum.plus(new Decimal(acc.balance)),
    new Decimal(0)
  );

  return totalAssets.minus(totalLiabilities);
}

/**
 * Verify ledger integrity (assets = liabilities + equity)
 *
 * The accounting equation must always hold:
 * Assets = Liabilities + Equity + (Revenue - Expenses)
 */
export async function verifyLedgerIntegrity(accountId: string): Promise<{
  valid: boolean;
  assets: string;
  liabilities: string;
  equity: string;
  revenue: string;
  expenses: string;
  difference: string;
}> {
  const accounts = await db.ledgerAccount.findMany({
    where: { accountId },
  });

  let assets = new Decimal(0);
  let liabilities = new Decimal(0);
  let equity = new Decimal(0);
  let revenue = new Decimal(0);
  let expenses = new Decimal(0);

  for (const account of accounts) {
    const balance = new Decimal(account.balance);

    switch (account.accountType) {
      case 'ASSET':
        assets = assets.plus(balance);
        break;
      case 'LIABILITY':
        liabilities = liabilities.plus(balance);
        break;
      case 'EQUITY':
        equity = equity.plus(balance);
        break;
      case 'REVENUE':
        revenue = revenue.plus(balance);
        break;
      case 'EXPENSE':
        expenses = expenses.plus(balance);
        break;
    }
  }

  // Assets = Liabilities + Equity + (Revenue - Expenses)
  const leftSide = assets;
  const rightSide = liabilities.plus(equity).plus(revenue).minus(expenses);
  const difference = leftSide.minus(rightSide);

  const valid = difference.abs().lessThan(0.01); // Allow 1 cent rounding error

  return {
    valid,
    assets: assets.toFixed(2),
    liabilities: liabilities.toFixed(2),
    equity: equity.toFixed(2),
    revenue: revenue.toFixed(2),
    expenses: expenses.toFixed(2),
    difference: difference.toFixed(2),
  };
}
