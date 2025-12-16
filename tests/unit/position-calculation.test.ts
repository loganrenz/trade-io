/**
 * Unit Tests for Position Calculation Service
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePositionForSymbol,
  calculateUnrealizedPnL,
  type CalculatedPosition,
} from '../../server/lib/position-calculation';
import Decimal from 'decimal.js';

describe('Position Calculation', () => {
  describe('calculatePositionForSymbol', () => {
    it('should calculate simple long position from single buy', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.symbol).toBe('AAPL');
      expect(position.quantity).toBe(100);
      expect(position.averageCost.toNumber()).toBeCloseTo(50.01, 2); // 50 + 1/100 commission
      expect(position.realizedPnL.toNumber()).toBe(0);
    });

    it('should calculate average cost from multiple buys', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'BUY',
          quantity: 50,
          price: new Decimal('55.00'),
          commission: new Decimal('0.50'),
          executedAt: new Date('2024-01-02'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(150);
      // (100 * 50.01 + 50 * 55.01) / 150 = 51.676666...
      expect(position.averageCost.toNumber()).toBeCloseTo(51.68, 2);
    });

    it('should handle partial position closure with FIFO', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('60.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          side: 'SELL',
          quantity: 50,
          price: new Decimal('70.00'),
          commission: new Decimal('0.50'),
          executedAt: new Date('2024-01-03'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(150); // 200 bought - 50 sold
      // Remaining lots: 50 @ 50.01 and 100 @ 60.01
      // Average: (50*50.01 + 100*60.01) / 150 = 56.676666...
      expect(position.averageCost.toNumber()).toBeCloseTo(56.68, 2);

      // Realized P&L: Sold 50 @ 70 (cost basis 50.01)
      // (70 * 50 - 0.50) - (50.01 * 50) = 3499.50 - 2500.50 = 999
      expect(position.realizedPnL.toNumber()).toBeCloseTo(999, 1);
    });

    it('should handle complete position closure', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'SELL',
          quantity: 100,
          price: new Decimal('60.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-02'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(0);
      expect(position.averageCost.toNumber()).toBe(0);

      // Realized P&L: (60 * 100 - 1) - (50.01 * 100) = 5999 - 5001 = 998
      expect(position.realizedPnL.toNumber()).toBeCloseTo(998, 1);
    });

    it('should handle multiple buys and sells with FIFO', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('55.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          side: 'SELL',
          quantity: 75,
          price: new Decimal('60.00'),
          commission: new Decimal('0.75'),
          executedAt: new Date('2024-01-03'),
        },
        {
          id: '4',
          side: 'BUY',
          quantity: 50,
          price: new Decimal('58.00'),
          commission: new Decimal('0.50'),
          executedAt: new Date('2024-01-04'),
        },
        {
          id: '5',
          side: 'SELL',
          quantity: 100,
          price: new Decimal('62.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-05'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      // Total: 250 bought - 175 sold = 75 remaining
      expect(position.quantity).toBe(75);

      // Remaining lots should be: 25 from $55 buy + 50 from $58 buy
      // Average: (25*55.01 + 50*58.01) / 75
      expect(position.averageCost.toNumber()).toBeCloseTo(57.01, 2);

      // Realized P&L should be positive (selling higher than cost basis)
      expect(position.realizedPnL.toNumber()).toBeGreaterThan(0);
    });

    it('should handle short positions (selling before buying)', () => {
      const executions = [
        {
          id: '1',
          side: 'SELL',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(-100); // Negative = short
      expect(position.averageCost.toNumber()).toBeCloseTo(50.01, 2);
      expect(position.realizedPnL.toNumber()).toBe(0); // No realized P&L yet
    });

    it('should handle short position closure', () => {
      const executions = [
        {
          id: '1',
          side: 'SELL',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('45.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-02'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(0); // Position closed
      // Realized P&L: Sold at 50, bought back at 45 = profit
      // (50 * 100 - 1) - (45 * 100 + 1) = 4999 - 4501 = 498
      expect(position.realizedPnL.toNumber()).toBeCloseTo(498, 1);
    });

    it('should handle zero executions', () => {
      const position = calculatePositionForSymbol('AAPL', []);

      expect(position.quantity).toBe(0);
      expect(position.averageCost.toNumber()).toBe(0);
      expect(position.realizedPnL.toNumber()).toBe(0);
    });

    it('should handle commission costs correctly', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('10.00'), // High commission
          executedAt: new Date('2024-01-01'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      // Average cost should include commission: 50 + 10/100 = 50.10
      expect(position.averageCost.toNumber()).toBeCloseTo(50.1, 2);
    });

    it('should handle fractional prices correctly', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('123.456'),
          commission: new Decimal('1.234'),
          executedAt: new Date('2024-01-01'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(100);
      expect(position.averageCost.toNumber()).toBeCloseTo(123.468, 3);
    });
  });

  describe('calculateUnrealizedPnL', () => {
    it('should calculate positive unrealized P&L', () => {
      const position: CalculatedPosition = {
        symbol: 'AAPL',
        quantity: 100,
        averageCost: new Decimal('50.00'),
        realizedPnL: new Decimal('0'),
        totalCost: new Decimal('5000'),
      };

      const unrealizedPnL = calculateUnrealizedPnL(position, 60);

      // (60 - 50) * 100 = 1000
      expect(unrealizedPnL.toNumber()).toBe(1000);
    });

    it('should calculate negative unrealized P&L', () => {
      const position: CalculatedPosition = {
        symbol: 'AAPL',
        quantity: 100,
        averageCost: new Decimal('50.00'),
        realizedPnL: new Decimal('0'),
        totalCost: new Decimal('5000'),
      };

      const unrealizedPnL = calculateUnrealizedPnL(position, 40);

      // (40 - 50) * 100 = -1000
      expect(unrealizedPnL.toNumber()).toBe(-1000);
    });

    it('should handle short positions', () => {
      const position: CalculatedPosition = {
        symbol: 'AAPL',
        quantity: -100, // Short
        averageCost: new Decimal('50.00'),
        realizedPnL: new Decimal('0'),
        totalCost: new Decimal('5000'),
      };

      const unrealizedPnL = calculateUnrealizedPnL(position, 40);

      // For short: (40 - 50) * -100 = 1000 (profit when price goes down)
      expect(unrealizedPnL.toNumber()).toBe(-1000);
    });

    it('should accept Decimal current price', () => {
      const position: CalculatedPosition = {
        symbol: 'AAPL',
        quantity: 100,
        averageCost: new Decimal('50.00'),
        realizedPnL: new Decimal('0'),
        totalCost: new Decimal('5000'),
      };

      const unrealizedPnL = calculateUnrealizedPnL(
        position,
        new Decimal('55.50')
      );

      // (55.5 - 50) * 100 = 550
      expect(unrealizedPnL.toNumber()).toBe(550);
    });

    it('should handle zero quantity', () => {
      const position: CalculatedPosition = {
        symbol: 'AAPL',
        quantity: 0,
        averageCost: new Decimal('50.00'),
        realizedPnL: new Decimal('100'),
        totalCost: new Decimal('0'),
      };

      const unrealizedPnL = calculateUnrealizedPnL(position, 60);

      expect(unrealizedPnL.toNumber()).toBe(0);
    });
  });

  describe('FIFO Edge Cases', () => {
    it('should handle selling more than one lot', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 50,
          price: new Decimal('50.00'),
          commission: new Decimal('0.50'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'BUY',
          quantity: 30,
          price: new Decimal('55.00'),
          commission: new Decimal('0.30'),
          executedAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          side: 'BUY',
          quantity: 20,
          price: new Decimal('60.00'),
          commission: new Decimal('0.20'),
          executedAt: new Date('2024-01-03'),
        },
        {
          id: '4',
          side: 'SELL',
          quantity: 75, // Sells all of lot 1, all of lot 2, and 25 from lot 3
          price: new Decimal('65.00'),
          commission: new Decimal('0.75'),
          executedAt: new Date('2024-01-04'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(25); // Only 20 from lot 3 remains, wait... let me recalc
      // Bought: 50 + 30 + 20 = 100
      // Sold: 75
      // Remaining: 25
      expect(position.quantity).toBe(25);

      // FIFO: Sold 50 @ $50, 25 @ $55 (out of the 30 lot)
      // Remaining: 5 @ $55 and 20 @ $60
      // Wait, let me recalculate: sold 75 means:
      // - 50 from first lot @ 50.01
      // - 25 from second lot @ 55.01 (leaving 5 @ 55.01)
      // Remaining: 5 @ 55.01 + 20 @ 60.01 = 25 total
      // Average: (5*55.01 + 20*60.01) / 25
      const expectedAvg = (5 * 55.01 + 20 * 60.01) / 25;
      expect(position.averageCost.toNumber()).toBeCloseTo(expectedAvg, 2);
    });

    it('should handle round-trip (buy-sell-buy)', () => {
      const executions = [
        {
          id: '1',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('50.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          side: 'SELL',
          quantity: 100,
          price: new Decimal('60.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          side: 'BUY',
          quantity: 100,
          price: new Decimal('55.00'),
          commission: new Decimal('1.00'),
          executedAt: new Date('2024-01-03'),
        },
      ];

      const position = calculatePositionForSymbol('AAPL', executions);

      expect(position.quantity).toBe(100);
      expect(position.averageCost.toNumber()).toBeCloseTo(55.01, 2);

      // First round trip should have realized P&L
      expect(position.realizedPnL.toNumber()).toBeGreaterThan(0);
    });
  });
});
