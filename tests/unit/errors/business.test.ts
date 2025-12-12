import { describe, it, expect } from 'vitest';
import {
  InsufficientFundsError,
  InvalidOrderError,
  InvalidSymbolError,
  ConcurrencyError,
} from '../../../server/errors/business';

describe('Business Error Classes', () => {
  describe('InsufficientFundsError', () => {
    it('should include required and available amounts', () => {
      const error = new InsufficientFundsError(10000, 5000);
      
      expect(error.message).toContain('10000');
      expect(error.message).toContain('5000');
      expect(error.required).toBe(10000);
      expect(error.available).toBe(5000);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('InvalidOrderError', () => {
    it('should include reason in message', () => {
      const error = new InvalidOrderError('Quantity must be positive');
      
      expect(error.message).toContain('Quantity must be positive');
      expect(error.code).toBe('INVALID_ORDER');
    });
  });

  describe('InvalidSymbolError', () => {
    it('should include symbol in error', () => {
      const error = new InvalidSymbolError('INVALID', 'Symbol not tradeable');
      
      expect(error.symbol).toBe('INVALID');
      expect(error.message).toContain('INVALID');
      expect(error.message).toContain('not tradeable');
    });
  });

  describe('ConcurrencyError', () => {
    it('should indicate resource conflict', () => {
      const error = new ConcurrencyError('Order');
      
      expect(error.message).toContain('modified by another request');
      expect(error.statusCode).toBe(409);
    });
  });
});
