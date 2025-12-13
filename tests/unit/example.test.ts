import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with objects', () => {
    const user = {
      id: 'test-123',
      email: 'test@example.com',
    };

    expect(user).toHaveProperty('id');
    expect(user.email).toContain('@');
  });
});
