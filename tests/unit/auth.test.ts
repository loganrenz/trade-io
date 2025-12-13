/**
 * Authentication Service Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/lib/db';
import {
  signup,
  login,
  logout,
  getUserById,
  getUserByEmail,
  getUserByProviderId,
  deleteUser,
} from '../../server/lib/auth';

describe('Authentication Service', () => {
  beforeAll(async () => {
    // Clean up
    await db.auditLog.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up
    await db.auditLog.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
  });

  beforeEach(async () => {
    // Clean users before each test
    await db.auditLog.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
  });

  describe('signup()', () => {
    it('should create a new user account', async () => {
      const user = await signup({
        email: 'test@example.com',
        provider: 'supabase',
        providerUserId: 'test-123',
        emailVerified: true,
      });

      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(true);
      expect(user.provider).toBe('supabase');
      expect(user.id).toBeTruthy();
    });

    it('should throw error if user already exists', async () => {
      await signup({
        email: 'duplicate@example.com',
        provider: 'supabase',
        providerUserId: 'dup-123',
      });

      await expect(
        signup({
          email: 'duplicate@example.com',
          provider: 'supabase',
          providerUserId: 'dup-456',
        })
      ).rejects.toThrow('User with this email already exists');
    });

    it('should create audit log for user creation', async () => {
      const user = await signup({
        email: 'audit@example.com',
        provider: 'supabase',
        providerUserId: 'audit-123',
      });

      const auditLogs = await db.auditLog.findMany({
        where: {
          actor: user.id,
          action: 'USER_CREATED',
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('login()', () => {
    it('should create new user on first login', async () => {
      const user = await login({
        email: 'newlogin@example.com',
        provider: 'supabase',
        providerUserId: 'login-123',
        emailVerified: true,
      });

      expect(user.email).toBe('newlogin@example.com');
      expect(user.id).toBeTruthy();

      // Verify user was created in database
      const dbUser = await db.user.findUnique({
        where: { email: 'newlogin@example.com' },
      });
      expect(dbUser).toBeTruthy();
    });

    it('should return existing user on subsequent login', async () => {
      const user1 = await login({
        email: 'repeat@example.com',
        provider: 'supabase',
        providerUserId: 'repeat-123',
      });

      const user2 = await login({
        email: 'repeat@example.com',
        provider: 'supabase',
        providerUserId: 'repeat-123',
      });

      expect(user1.id).toBe(user2.id);

      // Verify only one user exists
      const users = await db.user.findMany({
        where: { email: 'repeat@example.com' },
      });
      expect(users).toHaveLength(1);
    });

    it('should update email verified status on login', async () => {
      const user1 = await login({
        email: 'verify@example.com',
        provider: 'supabase',
        providerUserId: 'verify-123',
        emailVerified: false,
      });

      expect(user1.emailVerified).toBe(false);

      const user2 = await login({
        email: 'verify@example.com',
        provider: 'supabase',
        providerUserId: 'verify-123',
        emailVerified: true,
      });

      expect(user2.emailVerified).toBe(true);
    });

    it('should create audit log for user login', async () => {
      const user = await login({
        email: 'loginaudit@example.com',
        provider: 'supabase',
        providerUserId: 'loginaudit-123',
      });

      const auditLogs = await db.auditLog.findMany({
        where: {
          actor: user.id,
          action: 'USER_LOGIN',
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getUserById()', () => {
    it('should return user by ID', async () => {
      const created = await signup({
        email: 'getbyid@example.com',
        provider: 'supabase',
        providerUserId: 'getbyid-123',
      });

      const user = await getUserById(created.id);

      expect(user).toBeTruthy();
      expect(user!.email).toBe('getbyid@example.com');
    });

    it('should return null for non-existent user', async () => {
      const user = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(user).toBeNull();
    });

    it('should return null for deleted user', async () => {
      const created = await signup({
        email: 'deleted@example.com',
        provider: 'supabase',
        providerUserId: 'deleted-123',
      });

      await deleteUser(created.id);

      const user = await getUserById(created.id);
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail()', () => {
    it('should return user by email', async () => {
      await signup({
        email: 'emailsearch@example.com',
        provider: 'supabase',
        providerUserId: 'emailsearch-123',
      });

      const user = await getUserByEmail('emailsearch@example.com');

      expect(user).toBeTruthy();
      expect(user!.email).toBe('emailsearch@example.com');
    });

    it('should return null for non-existent email', async () => {
      const user = await getUserByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('getUserByProviderId()', () => {
    it('should return user by provider ID', async () => {
      await signup({
        email: 'provider@example.com',
        provider: 'google',
        providerUserId: 'google-xyz-789',
      });

      const user = await getUserByProviderId('google', 'google-xyz-789');

      expect(user).toBeTruthy();
      expect(user!.email).toBe('provider@example.com');
    });

    it('should return null for non-existent provider ID', async () => {
      const user = await getUserByProviderId('google', 'non-existent');
      expect(user).toBeNull();
    });
  });

  describe('logout()', () => {
    it('should create audit log for logout', async () => {
      const user = await signup({
        email: 'logout@example.com',
        provider: 'supabase',
        providerUserId: 'logout-123',
      });

      await logout(user.id);

      const auditLogs = await db.auditLog.findMany({
        where: {
          actor: user.id,
          action: 'USER_LOGOUT',
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('deleteUser()', () => {
    it('should soft delete user account', async () => {
      const user = await signup({
        email: 'softdelete@example.com',
        provider: 'supabase',
        providerUserId: 'softdelete-123',
      });

      await deleteUser(user.id);

      const dbUser = await db.user.findUnique({
        where: { id: user.id },
      });

      expect(dbUser).toBeTruthy();
      expect(dbUser!.deletedAt).toBeTruthy();
    });

    it('should create audit log for user deletion', async () => {
      const user = await signup({
        email: 'deleteaudit@example.com',
        provider: 'supabase',
        providerUserId: 'deleteaudit-123',
      });

      await deleteUser(user.id);

      const auditLogs = await db.auditLog.findMany({
        where: {
          actor: user.id,
          action: 'USER_DELETED',
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
