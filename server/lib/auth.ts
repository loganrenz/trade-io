/**
 * Authentication Service
 * Handles user authentication, session management, and token validation
 */
import { db } from './db';
import { logger } from './logger';
import { audit, AuditAction, AuditResource } from './audit';
import { UserRole } from './authz';
import type { User } from '@prisma/client';

export interface SignupInput {
  email: string;
  provider: string;
  providerUserId: string;
  emailVerified?: boolean;
  role?: UserRole;
}

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  provider: string;
  createdAt: Date;
}

/**
 * Create a new user account
 */
export async function signup(input: SignupInput): Promise<AuthUser> {
  logger.info({ email: input.email }, 'Creating new user account');

  // Check if user already exists
  const existing = await db.user.findUnique({
    where: { email: input.email },
  });

  if (existing && !existing.deletedAt) {
    throw new Error('User with this email already exists');
  }

  // Create user
  const user = await db.user.create({
    data: {
      email: input.email,
      emailVerified: input.emailVerified ?? false,
      role: input.role ?? UserRole.USER,
      provider: input.provider,
      providerUserId: input.providerUserId,
    },
  });

  // Audit log
  await audit({
    actor: user.id,
    action: AuditAction.USER_CREATED,
    resource: AuditResource.USER,
    resourceId: user.id,
    metadata: {
      email: user.email,
      provider: user.provider,
    },
  });

  logger.info({ userId: user.id }, 'User account created successfully');

  return toAuthUser(user);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  return user ? toAuthUser(user) : null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const user = await db.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });

  return user ? toAuthUser(user) : null;
}

/**
 * Get user by provider ID
 */
export async function getUserByProviderId(
  provider: string,
  providerUserId: string
): Promise<AuthUser | null> {
  const user = await db.user.findFirst({
    where: {
      provider,
      providerUserId,
      deletedAt: null,
    },
  });

  return user ? toAuthUser(user) : null;
}

/**
 * Login - Get or create user from provider
 */
export async function login(input: SignupInput): Promise<AuthUser> {
  logger.info({ email: input.email }, 'User login attempt');

  // Try to find existing user
  let user = await db.user.findFirst({
    where: {
      provider: input.provider,
      providerUserId: input.providerUserId,
      deletedAt: null,
    },
  });

  // Create user if doesn't exist
  if (!user) {
    logger.info({ email: input.email }, 'Creating new user on first login');
    user = await db.user.create({
      data: {
        email: input.email,
        emailVerified: input.emailVerified ?? false,
        provider: input.provider,
        providerUserId: input.providerUserId,
      },
    });

    await audit({
      actor: user.id,
      action: AuditAction.USER_CREATED,
      resource: AuditResource.USER,
      resourceId: user.id,
      metadata: {
        email: user.email,
        provider: user.provider,
      },
    });
  }

  // Update email verified status if changed
  if (input.emailVerified && !user.emailVerified) {
    user = await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  // Audit log
  await audit({
    actor: user.id,
    action: AuditAction.USER_LOGIN,
    resource: AuditResource.USER,
    resourceId: user.id,
  });

  logger.info({ userId: user.id }, 'User logged in successfully');

  return toAuthUser(user);
}

/**
 * Logout - Record audit log
 */
export async function logout(userId: string): Promise<void> {
  logger.info({ userId }, 'User logout');

  await audit({
    actor: userId,
    action: AuditAction.USER_LOGOUT,
    resource: AuditResource.USER,
    resourceId: userId,
  });
}

/**
 * Soft delete user account
 */
export async function deleteUser(userId: string): Promise<void> {
  logger.info({ userId }, 'Deleting user account');

  await db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });

  await audit({
    actor: userId,
    action: AuditAction.USER_DELETED,
    resource: AuditResource.USER,
    resourceId: userId,
  });

  logger.info({ userId }, 'User account deleted');
}

/**
 * Convert User to AuthUser (omit sensitive fields)
 */
function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role as UserRole,
    provider: user.provider || 'unknown',
    createdAt: user.createdAt,
  };
}

/**
 * Update user role (admin only operation)
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<AuthUser> {
  logger.info({ userId, newRole: role }, 'Updating user role');

  const user = await db.user.update({
    where: { id: userId },
    data: { role },
  });

  await audit({
    actor: userId,
    action: AuditAction.USER_UPDATED,
    resource: AuditResource.USER,
    resourceId: userId,
    metadata: { newRole: role },
  });

  logger.info({ userId, role }, 'User role updated successfully');

  return toAuthUser(user);
}
