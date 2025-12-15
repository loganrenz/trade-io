/**
 * Transaction History tRPC Router
 *
 * Provides endpoints for querying transaction history from the ledger.
 */

import { z } from 'zod';
import { router, accountProtectedProcedure } from '../trpc';
import { db } from '../../lib/db';
import { logger } from '../../lib/logger';

/**
 * Transaction router
 */
export const transactionRouter = router({
  /**
   * List transactions for an account
   *
   * Returns paginated transaction history with filtering options.
   */
  list: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        symbol: z.string().optional(),
        type: z
          .enum([
            'DEPOSIT',
            'WITHDRAWAL',
            'TRADE',
            'DIVIDEND',
            'FEE',
            'ADJUSTMENT',
          ])
          .optional(),
        page: z.number().min(1).optional().default(1),
        perPage: z.number().min(1).max(100).optional().default(50),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Listing transactions',
        accountId: input.accountId,
        filters: {
          startDate: input.startDate,
          endDate: input.endDate,
          symbol: input.symbol,
          type: input.type,
        },
        page: input.page,
        perPage: input.perPage,
      });

      const skip = (input.page - 1) * input.perPage;

      // Build where clause
      const where: any = {
        accountId: input.accountId,
      };

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = input.startDate;
        }
        if (input.endDate) {
          where.createdAt.lte = input.endDate;
        }
      }

      if (input.symbol) {
        where.symbol = input.symbol;
      }

      if (input.type) {
        where.entryType = input.type;
      }

      const [transactions, totalCount] = await Promise.all([
        db.ledgerEntry.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: input.perPage,
        }),
        db.ledgerEntry.count({ where }),
      ]);

      return {
        transactions: transactions.map((t) => ({
          id: t.id,
          accountId: t.accountId,
          type: t.entryType,
          symbol: t.symbol,
          quantity: t.quantity,
          amount: t.cashAmount.toNumber(),
          balanceAfter: t.balanceAfter.toNumber(),
          description: t.description,
          referenceId: t.referenceId,
          createdAt: t.createdAt,
        })),
        pagination: {
          page: input.page,
          perPage: input.perPage,
          totalCount,
          totalPages: Math.ceil(totalCount / input.perPage),
          hasMore: skip + transactions.length < totalCount,
        },
      };
    }),

  /**
   * Get transaction details by ID
   */
  getById: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        transactionId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting transaction by ID',
        accountId: input.accountId,
        transactionId: input.transactionId,
      });

      const transaction = await db.ledgerEntry.findFirst({
        where: {
          id: input.transactionId,
          accountId: input.accountId,
        },
      });

      if (!transaction) {
        return null;
      }

      // Get related execution if this is a trade
      let execution = null;
      if (transaction.referenceId && transaction.entryType === 'TRADE') {
        execution = await db.execution.findUnique({
          where: { id: transaction.referenceId },
          include: {
            order: {
              select: {
                id: true,
                orderType: true,
                side: true,
                timeInForce: true,
              },
            },
          },
        });
      }

      return {
        id: transaction.id,
        accountId: transaction.accountId,
        type: transaction.entryType,
        symbol: transaction.symbol,
        quantity: transaction.quantity,
        amount: transaction.cashAmount.toNumber(),
        balanceAfter: transaction.balanceAfter.toNumber(),
        description: transaction.description,
        referenceId: transaction.referenceId,
        createdAt: transaction.createdAt,
        execution: execution
          ? {
              id: execution.id,
              price: execution.price.toNumber(),
              commission: execution.commission.toNumber(),
              executedAt: execution.executedAt,
              order: execution.order,
            }
          : null,
      };
    }),

  /**
   * Get transaction summary for a date range
   */
  getSummary: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Getting transaction summary',
        accountId: input.accountId,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      const transactions = await db.ledgerEntry.findMany({
        where: {
          accountId: input.accountId,
          createdAt: {
            gte: input.startDate,
            lte: input.endDate,
          },
        },
      });

      const summary = {
        totalTransactions: transactions.length,
        deposits: 0,
        depositAmount: 0,
        withdrawals: 0,
        withdrawalAmount: 0,
        trades: 0,
        tradeAmount: 0,
        dividends: 0,
        dividendAmount: 0,
        fees: 0,
        feeAmount: 0,
      };

      for (const t of transactions) {
        const amount = t.cashAmount.toNumber();

        switch (t.entryType) {
          case 'DEPOSIT':
            summary.deposits++;
            summary.depositAmount += amount;
            break;
          case 'WITHDRAWAL':
            summary.withdrawals++;
            summary.withdrawalAmount += Math.abs(amount);
            break;
          case 'TRADE':
            summary.trades++;
            summary.tradeAmount += Math.abs(amount);
            break;
          case 'DIVIDEND':
            summary.dividends++;
            summary.dividendAmount += amount;
            break;
          case 'FEE':
            summary.fees++;
            summary.feeAmount += Math.abs(amount);
            break;
        }
      }

      return summary;
    }),

  /**
   * Export transactions to CSV format
   *
   * Returns CSV data as a string for download.
   */
  exportCsv: accountProtectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      logger.info({
        msg: 'Exporting transactions to CSV',
        accountId: input.accountId,
        startDate: input.startDate,
        endDate: input.endDate,
      });

      const where: any = {
        accountId: input.accountId,
      };

      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) {
          where.createdAt.gte = input.startDate;
        }
        if (input.endDate) {
          where.createdAt.lte = input.endDate;
        }
      }

      const transactions = await db.ledgerEntry.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Build CSV
      const headers = [
        'Date',
        'Type',
        'Symbol',
        'Quantity',
        'Amount',
        'Balance After',
        'Description',
        'Reference ID',
      ];

      const rows = transactions.map((t) => [
        t.createdAt.toISOString(),
        t.entryType,
        t.symbol ?? '',
        t.quantity ?? '',
        t.cashAmount.toString(),
        t.balanceAfter.toString(),
        t.description,
        t.referenceId ?? '',
      ]);

      const csvData = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      return {
        csv: csvData,
        filename: `transactions_${input.accountId}_${new Date().toISOString().split('T')[0]}.csv`,
        rowCount: transactions.length,
      };
    }),
});
