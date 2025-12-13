/**
 * Account Router
 * Account management endpoints
 */
import { router, protectedProcedure, accountProtectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../lib/db';
import { userAccountsFilter } from '../../lib/authz';
import { audit, AuditAction, AuditResource } from '../../lib/audit';

/**
 * Get account input schema
 */
const getAccountSchema = z.object({
  accountId: z.string().uuid(),
});

/**
 * Create account input schema
 */
const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['INDIVIDUAL', 'JOINT', 'MARGIN']).default('INDIVIDUAL'),
  initialCash: z.number().positive().default(100000),
});

/**
 * Update account input schema
 */
const updateAccountSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
});

export const accountRouter = router({
  /**
   * List all accounts for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const accounts = await db.account.findMany({
      where: userAccountsFilter(ctx.userId),
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        initialCash: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return accounts;
  }),

  /**
   * Get account details by ID
   */
  get: accountProtectedProcedure.input(getAccountSchema).query(async ({ input }) => {
    const account = await db.account.findUnique({
      where: { id: input.accountId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        initialCash: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return account;
  }),

  /**
   * Get account summary with positions and orders
   */
  getSummary: accountProtectedProcedure.input(getAccountSchema).query(async ({ input }) => {
    const account = await db.account.findUnique({
      where: { id: input.accountId },
      include: {
        positions: {
          where: {
            quantity: {
              not: 0,
            },
          },
        },
        orders: {
          where: {
            status: {
              in: ['PENDING', 'ACCEPTED', 'PARTIAL'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    return account;
  }),

  /**
   * Create a new account
   */
  create: protectedProcedure.input(createAccountSchema).mutation(async ({ input, ctx }) => {
    const account = await db.account.create({
      data: {
        name: input.name,
        type: input.type,
        initialCash: input.initialCash,
        ownerId: ctx.userId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        initialCash: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await audit({
      actor: ctx.userId,
      action: AuditAction.ACCOUNT_CREATED,
      resource: AuditResource.ACCOUNT,
      resourceId: account.id,
      metadata: {
        name: account.name,
        type: account.type,
        initialCash: account.initialCash.toString(),
      },
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return account;
  }),

  /**
   * Update account
   */
  update: accountProtectedProcedure.input(updateAccountSchema).mutation(async ({ input, ctx }) => {
    const account = await db.account.update({
      where: { id: input.accountId },
      data: {
        name: input.name,
        status: input.status,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        initialCash: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await audit({
      actor: ctx.userId,
      action: AuditAction.ACCOUNT_UPDATED,
      resource: AuditResource.ACCOUNT,
      resourceId: account.id,
      metadata: {
        name: input.name,
        status: input.status,
      },
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return account;
  }),
});
