import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  InternalServerError,
} from '../../../server/errors/base';

describe('Base Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with field', () => {
      const error = new ValidationError('Invalid email format', 'email');
      
      expect(error.message).toBe('Invalid email format');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.field).toBe('email');
      expect(error.isOperational).toBe(true);
    });

    it('should serialize to JSON', () => {
      const error = new ValidationError('Invalid email', 'email');
      const json = error.toJSON();
      
      expect(json).toHaveProperty('message', 'Invalid email');
      expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(json.context).toHaveProperty('field', 'email');
    });
  });

  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toContain('logged in');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error for resource', () => {
      const error = new NotFoundError('Order', 'order-123');
      
      expect(error.message).toContain('Order');
      expect(error.message).toContain('order-123');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RateLimitError', () => {
    it('should include retry after time', () => {
      const error = new RateLimitError('Too many requests', 60);
      
      expect(error.retryAfter).toBe(60);
      expect(error.statusCode).toBe(429);
    });
  });

  describe('InternalServerError', () => {
    it('should mark as non-operational', () => {
      const error = new InternalServerError();
      
      expect(error.isOperational).toBe(false);
      expect(error.statusCode).toBe(500);
    });
  });
});
