/**
 * Test data factory for User entities
 * Used to create consistent test data across unit and integration tests
 */

export interface UserFactoryParams {
  id?: string;
  email?: string;
  emailVerified?: boolean;
  provider?: string | null;
  providerUserId?: string | null;
}

export function createTestUser(overrides: UserFactoryParams = {}) {
  const timestamp = Date.now();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    email: overrides.email ?? `test-${timestamp}@example.com`,
    emailVerified: overrides.emailVerified ?? true,
    provider: overrides.provider ?? 'supabase',
    providerUserId: overrides.providerUserId ?? `user_${timestamp}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

export function createTestUsers(count: number, overrides: UserFactoryParams = {}) {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({
      ...overrides,
      email: overrides.email ?? `test-user-${i}-${Date.now()}@example.com`,
    })
  );
}
