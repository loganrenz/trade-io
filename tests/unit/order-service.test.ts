/**
 * Order Service Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as orderService from '../../server/lib/order-service';
import { db } from '../../server/lib/db';
import { ConcurrencyError } from '../../server/errors';

// Mock dependencies
vi.mock('../../server/lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../server/lib/audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../server/lib/order-validation', () => ({
  validateOrder: vi.fn().mockResolvedValue(undefined),
  validateOrderModification: vi.fn().mockResolvedValue(undefined),
  validateOrderCancellation: vi.fn().mockResolvedValue(undefined),
}));

describe('Order Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('placeOrder', () => {
    it('should create a new order', async () => {
      const mockOrder = {
        id: 'order-123',
        accountId: 'acc-123',
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 10,
        orderType: 'MARKET',
        status: 'PENDING',
        timeInForce: 'DAY',
        idempotencyKey: 'test-key',
        filledQuantity: 0,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(null);
      vi.mocked(db.order.create).mockResolvedValue(mockOrder as any);
      vi.mocked(db.orderEvent.create).mockResolvedValue({} as any);

      const order = await orderService.placeOrder(
        {
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        },
        'user-123',
        'test-key'
      );

      expect(order).toEqual(mockOrder);
      expect(db.order.create).toHaveBeenCalled();
      expect(db.orderEvent.create).toHaveBeenCalled();
    });

    it('should return existing order for duplicate idempotency key', async () => {
      const existingOrder = {
        id: 'order-123',
        idempotencyKey: 'test-key',
        status: 'FILLED',
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(existingOrder as any);

      const order = await orderService.placeOrder(
        {
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        },
        'user-123',
        'test-key'
      );

      expect(order).toEqual(existingOrder);
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it('should set expiration for DAY orders', async () => {
      vi.mocked(db.order.findUnique).mockResolvedValue(null);
      vi.mocked(db.order.create).mockResolvedValue({} as any);
      vi.mocked(db.orderEvent.create).mockResolvedValue({} as any);

      await orderService.placeOrder(
        {
          accountId: 'acc-123',
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 10,
          orderType: 'MARKET',
          timeInForce: 'DAY',
        },
        'user-123',
        'test-key'
      );

      expect(db.order.create).toHaveBeenCalled();
      const createCall = vi.mocked(db.order.create).mock.calls[0][0];
      expect(createCall.data.expiresAt).toBeDefined();
    });
  });

  describe('modifyOrder', () => {
    it('should modify order quantity', async () => {
      const currentOrder = {
        id: 'order-123',
        status: 'PENDING',
        version: 1,
        quantity: 10,
      };

      const updatedOrder = {
        ...currentOrder,
        quantity: 20,
        version: 2,
      };

      vi.mocked(db.order.findUnique)
        .mockResolvedValueOnce(currentOrder as any)
        .mockResolvedValueOnce(updatedOrder as any);
      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.orderEvent.create).mockResolvedValue({} as any);

      const order = await orderService.modifyOrder('order-123', { quantity: 20 }, 'user-123');

      expect(order.quantity).toBe(20);
      expect(db.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-123', version: 1 },
        data: expect.objectContaining({ quantity: 20, version: 2 }),
      });
    });

    it('should throw ConcurrencyError on version mismatch', async () => {
      const currentOrder = {
        id: 'order-123',
        status: 'PENDING',
        version: 1,
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(currentOrder as any);
      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 0 } as any);

      await expect(
        orderService.modifyOrder('order-123', { quantity: 20 }, 'user-123')
      ).rejects.toThrow(ConcurrencyError);
    });
  });

  describe('cancelOrder', () => {
    it('should cancel an order', async () => {
      const currentOrder = {
        id: 'order-123',
        status: 'PENDING',
        version: 1,
        filledQuantity: 0,
      };

      const cancelledOrder = {
        ...currentOrder,
        status: 'CANCELLED',
        version: 2,
      };

      vi.mocked(db.order.findUnique)
        .mockResolvedValueOnce(currentOrder as any)
        .mockResolvedValueOnce(cancelledOrder as any);
      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(db.orderEvent.create).mockResolvedValue({} as any);

      const order = await orderService.cancelOrder('order-123', 'user-123');

      expect(order.status).toBe('CANCELLED');
      expect(db.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-123', version: 1 },
        data: { status: 'CANCELLED', version: 2 },
      });
    });

    it('should throw ConcurrencyError on version mismatch', async () => {
      const currentOrder = {
        id: 'order-123',
        status: 'PENDING',
        version: 1,
      };

      vi.mocked(db.order.findUnique).mockResolvedValue(currentOrder as any);
      vi.mocked(db.order.updateMany).mockResolvedValue({ count: 0 } as any);

      await expect(orderService.cancelOrder('order-123', 'user-123')).rejects.toThrow(
        ConcurrencyError
      );
    });
  });

  describe('getOrders', () => {
    it('should return orders for account', async () => {
      const mockOrders = [
        { id: 'order-1', symbol: 'AAPL', status: 'FILLED' },
        { id: 'order-2', symbol: 'GOOGL', status: 'PENDING' },
      ];

      vi.mocked(db.order.findMany).mockResolvedValue(mockOrders as any);
      vi.mocked(db.order.count).mockResolvedValue(2);

      const result = await orderService.getOrders({
        accountId: 'acc-123',
        limit: 50,
        offset: 0,
      });

      expect(result.orders).toEqual(mockOrders);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([]);
      vi.mocked(db.order.count).mockResolvedValue(0);

      await orderService.getOrders({
        accountId: 'acc-123',
        status: ['PENDING', 'ACCEPTED'],
      });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'ACCEPTED'] },
          }),
        })
      );
    });

    it('should filter by symbol', async () => {
      vi.mocked(db.order.findMany).mockResolvedValue([]);
      vi.mocked(db.order.count).mockResolvedValue(0);

      await orderService.getOrders({
        accountId: 'acc-123',
        symbol: 'AAPL',
      });

      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: 'AAPL',
          }),
        })
      );
    });
  });

  describe('getOrderHistory', () => {
    it('should return order events', async () => {
      const mockEvents = [
        { id: 'evt-1', eventType: 'CREATED', createdAt: new Date() },
        { id: 'evt-2', eventType: 'ACCEPTED', createdAt: new Date() },
      ];

      vi.mocked(db.orderEvent.findMany).mockResolvedValue(mockEvents as any);

      const events = await orderService.getOrderHistory('order-123');

      expect(events).toEqual(mockEvents);
      expect(db.orderEvent.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-123' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
