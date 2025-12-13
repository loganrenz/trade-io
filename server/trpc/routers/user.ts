/**
 * User Router
 * User profile management endpoints
 */
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { db } from '../../lib/db';
import { audit, AuditAction, AuditResource } from '../../lib/audit';

/**
 * Update profile input schema
 */
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  emailVerified: z.boolean().optional(),
});

export const userRouter = router({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findFirst({
      where: {
        id: ctx.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(async ({ input, ctx }) => {
    const user = await db.user.update({
      where: { id: ctx.userId },
      data: {
        email: input.email,
        emailVerified: input.emailVerified,
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await audit({
      actor: ctx.userId,
      action: AuditAction.USER_UPDATED,
      resource: AuditResource.USER,
      resourceId: ctx.userId,
      metadata: input,
      requestId: ctx.requestId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return user;
  }),
});
