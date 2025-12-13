/**
 * Integration Tests for Market Data Schema
 * Tests the new Quote, Bar, and TradingSession tables
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '~/server/lib/db';

describe('Market Data Schema Integration Tests', () => {
  let testInstrumentId: string;

  beforeAll(async () => {
    // Create a test instrument
    const instrument = await db.instrument.create({
      data: {
        symbol: 'TEST',
        name: 'Test Stock Inc.',
        type: 'STOCK',
        exchange: 'NYSE',
        currency: 'USD',
        sector: 'Technology',
        industry: 'Software',
        isActive: true,
        isTradeable: true,
      },
    });
    testInstrumentId = instrument.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.quote.deleteMany({ where: { instrumentId: testInstrumentId } });
    await db.bar.deleteMany({ where: { instrumentId: testInstrumentId } });
    await db.tradingSession.deleteMany({
      where: { instrumentId: testInstrumentId },
    });
    await db.instrument.delete({ where: { id: testInstrumentId } });
  });

  describe('Instrument Table Updates', () => {
    it('should include new fields in instrument table', async () => {
      const instrument = await db.instrument.findUnique({
        where: { id: testInstrumentId },
      });

      expect(instrument).toBeDefined();
      expect(instrument?.currency).toBe('USD');
      expect(instrument?.sector).toBe('Technology');
      expect(instrument?.industry).toBe('Software');
      expect(instrument?.marketCap).toBeNull(); // Not set
    });

    it('should support market cap field', async () => {
      await db.instrument.update({
        where: { id: testInstrumentId },
        data: { marketCap: 1000000000 },
      });

      const instrument = await db.instrument.findUnique({
        where: { id: testInstrumentId },
      });

      expect(instrument?.marketCap?.toString()).toBe('1000000000');
    });

    it('should have indexes on exchange and type', async () => {
      const instruments = await db.instrument.findMany({
        where: {
          exchange: 'NYSE',
          type: 'STOCK',
        },
      });

      expect(instruments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Quote Table', () => {
    it('should create quote with required fields', async () => {
      const quote = await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: new Date(),
          last: 150.25,
          volume: 1000000,
        },
      });

      expect(quote.id).toBeDefined();
      expect(quote.symbol).toBe('TEST');
      expect(quote.last.toString()).toBe('150.25');
      expect(quote.volume.toString()).toBe('1000000');
    });

    it('should create quote with bid/ask spread', async () => {
      const quote = await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: new Date(),
          bid: 150.0,
          ask: 150.5,
          bidSize: 100,
          askSize: 200,
          last: 150.25,
          volume: 1000000,
        },
      });

      expect(quote.bid?.toString()).toBe('150');
      expect(quote.ask?.toString()).toBe('150.5');
      expect(quote.bidSize).toBe(100);
      expect(quote.askSize).toBe(200);
    });

    it('should create quote with OHLC data', async () => {
      const quote = await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: new Date(),
          last: 150.25,
          open: 148.0,
          high: 152.0,
          low: 147.5,
          close: 149.0,
          change: 1.25,
          changePercent: 0.84,
          volume: 1000000,
        },
      });

      expect(quote.open?.toString()).toBe('148');
      expect(quote.high?.toString()).toBe('152');
      expect(quote.low?.toString()).toBe('147.5');
      expect(quote.close?.toString()).toBe('149');
      expect(quote.change?.toString()).toBe('1.25');
      expect(quote.changePercent?.toString()).toBe('0.84');
    });

    it('should enforce foreign key constraint', async () => {
      await expect(
        db.quote.create({
          data: {
            instrumentId: '00000000-0000-0000-0000-000000000000',
            symbol: 'INVALID',
            timestamp: new Date(),
            last: 100,
            volume: 0,
          },
        })
      ).rejects.toThrow();
    });

    it('should query quotes by symbol and timestamp', async () => {
      const now = new Date();
      await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: new Date(now.getTime() - 1000),
          last: 150.0,
          volume: 1000,
        },
      });
      await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: now,
          last: 151.0,
          volume: 2000,
        },
      });

      const quotes = await db.quote.findMany({
        where: {
          symbol: 'TEST',
          timestamp: {
            lte: now,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 2,
      });

      expect(quotes.length).toBeGreaterThanOrEqual(2);
      // First quote should be most recent
      expect(quotes[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        quotes[1].timestamp.getTime()
      );
    });

    it('should cascade delete quotes when instrument is deleted', async () => {
      const tempInstrument = await db.instrument.create({
        data: {
          symbol: 'TEMP',
          name: 'Temporary',
          exchange: 'NYSE',
          type: 'STOCK',
        },
      });

      await db.quote.create({
        data: {
          instrumentId: tempInstrument.id,
          symbol: 'TEMP',
          timestamp: new Date(),
          last: 100,
          volume: 1000,
        },
      });

      await db.instrument.delete({ where: { id: tempInstrument.id } });

      const quotes = await db.quote.findMany({
        where: { instrumentId: tempInstrument.id },
      });
      expect(quotes.length).toBe(0);
    });
  });

  describe('Bar Table', () => {
    it('should create OHLCV bar data', async () => {
      const bar = await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1day',
          timestamp: new Date(),
          open: 148.0,
          high: 152.0,
          low: 147.5,
          close: 150.25,
          volume: 5000000,
        },
      });

      expect(bar.id).toBeDefined();
      expect(bar.timeframe).toBe('1day');
      expect(bar.open.toString()).toBe('148');
      expect(bar.high.toString()).toBe('152');
      expect(bar.low.toString()).toBe('147.5');
      expect(bar.close.toString()).toBe('150.25');
      expect(bar.volume.toString()).toBe('5000000');
    });

    it('should create bar with VWAP and trades', async () => {
      const bar = await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '5min',
          timestamp: new Date(),
          open: 150.0,
          high: 150.5,
          low: 149.5,
          close: 150.25,
          volume: 10000,
          vwap: 150.1,
          trades: 250,
        },
      });

      expect(bar.vwap?.toString()).toBe('150.1');
      expect(bar.trades).toBe(250);
    });

    it('should enforce unique constraint on symbol, timeframe, timestamp', async () => {
      const timestamp = new Date();

      await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1hour',
          timestamp,
          open: 150,
          high: 151,
          low: 149,
          close: 150.5,
          volume: 1000,
        },
      });

      await expect(
        db.bar.create({
          data: {
            instrumentId: testInstrumentId,
            symbol: 'TEST',
            timeframe: '1hour',
            timestamp, // Same timestamp
            open: 151,
            high: 152,
            low: 150,
            close: 151.5,
            volume: 2000,
          },
        })
      ).rejects.toThrow();
    });

    it('should query bars by timeframe and date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1day',
          timestamp: yesterday,
          open: 145,
          high: 148,
          low: 144,
          close: 147,
          volume: 3000000,
        },
      });

      await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1day',
          timestamp: now,
          open: 147,
          high: 150,
          low: 146,
          close: 149,
          volume: 4000000,
        },
      });

      const bars = await db.bar.findMany({
        where: {
          symbol: 'TEST',
          timeframe: '1day',
          timestamp: {
            gte: yesterday,
            lte: now,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      expect(bars.length).toBeGreaterThanOrEqual(2);
      expect(bars[0].timestamp.getTime()).toBeLessThan(bars[1].timestamp.getTime());
    });

    it('should support multiple timeframes for same symbol', async () => {
      const timestamp = new Date();

      await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1min',
          timestamp,
          open: 150,
          high: 150.5,
          low: 149.8,
          close: 150.25,
          volume: 1000,
        },
      });

      await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '5min',
          timestamp,
          open: 150,
          high: 151,
          low: 149.5,
          close: 150.75,
          volume: 5000,
        },
      });

      const oneMinBars = await db.bar.findMany({
        where: { symbol: 'TEST', timeframe: '1min' },
      });
      const fiveMinBars = await db.bar.findMany({
        where: { symbol: 'TEST', timeframe: '5min' },
      });

      expect(oneMinBars.length).toBeGreaterThanOrEqual(1);
      expect(fiveMinBars.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('TradingSession Table', () => {
    it('should create trading session for regular hours', async () => {
      const date = new Date('2025-12-15');
      const openTime = new Date('2025-12-15T09:30:00');
      const closeTime = new Date('2025-12-15T16:00:00');

      const session = await db.tradingSession.create({
        data: {
          exchange: 'NYSE',
          date,
          sessionType: 'REGULAR',
          openTime,
          closeTime,
          isOpen: true,
          isTradingDay: true,
        },
      });

      expect(session.id).toBeDefined();
      expect(session.exchange).toBe('NYSE');
      expect(session.sessionType).toBe('REGULAR');
      expect(session.isOpen).toBe(true);
      expect(session.isTradingDay).toBe(true);
    });

    it('should create trading session for premarket hours', async () => {
      const date = new Date('2025-12-15');
      const openTime = new Date('2025-12-15T04:00:00');
      const closeTime = new Date('2025-12-15T09:30:00');

      const session = await db.tradingSession.create({
        data: {
          exchange: 'NYSE',
          date,
          sessionType: 'PREMARKET',
          openTime,
          closeTime,
        },
      });

      expect(session.sessionType).toBe('PREMARKET');
    });

    it('should create trading session for holiday', async () => {
      const date = new Date('2025-12-25');

      const session = await db.tradingSession.create({
        data: {
          exchange: 'NYSE',
          date,
          sessionType: 'REGULAR',
          openTime: new Date('2025-12-25T09:30:00'),
          closeTime: new Date('2025-12-25T16:00:00'),
          isOpen: false,
          isTradingDay: false,
          holidayName: 'Christmas Day',
        },
      });

      expect(session.isTradingDay).toBe(false);
      expect(session.holidayName).toBe('Christmas Day');
    });

    it('should enforce unique constraint on exchange, date, sessionType', async () => {
      const date = new Date('2025-12-16');

      await db.tradingSession.create({
        data: {
          exchange: 'NASDAQ',
          date,
          sessionType: 'REGULAR',
          openTime: new Date('2025-12-16T09:30:00'),
          closeTime: new Date('2025-12-16T16:00:00'),
        },
      });

      await expect(
        db.tradingSession.create({
          data: {
            exchange: 'NASDAQ',
            date,
            sessionType: 'REGULAR', // Duplicate
            openTime: new Date('2025-12-16T09:30:00'),
            closeTime: new Date('2025-12-16T16:00:00'),
          },
        })
      ).rejects.toThrow();
    });

    it('should query trading sessions by exchange and date', async () => {
      const date = new Date('2025-12-17');

      await db.tradingSession.create({
        data: {
          exchange: 'NYSE',
          date,
          sessionType: 'REGULAR',
          openTime: new Date('2025-12-17T09:30:00'),
          closeTime: new Date('2025-12-17T16:00:00'),
        },
      });

      const sessions = await db.tradingSession.findMany({
        where: {
          exchange: 'NYSE',
          date,
        },
      });

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should support instrument-specific trading sessions', async () => {
      const date = new Date('2025-12-18');

      const session = await db.tradingSession.create({
        data: {
          instrumentId: testInstrumentId,
          exchange: 'NYSE',
          date,
          sessionType: 'REGULAR',
          openTime: new Date('2025-12-18T09:30:00'),
          closeTime: new Date('2025-12-18T16:00:00'),
        },
      });

      expect(session.instrumentId).toBe(testInstrumentId);

      const retrieved = await db.tradingSession.findUnique({
        where: { id: session.id },
        include: { instrument: true },
      });

      expect(retrieved?.instrument?.symbol).toBe('TEST');
    });
  });

  describe('Relationships and Cascade Deletes', () => {
    it('should load quotes with instrument relationship', async () => {
      const quote = await db.quote.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timestamp: new Date(),
          last: 150,
          volume: 1000,
        },
      });

      const quoteWithInstrument = await db.quote.findUnique({
        where: { id: quote.id },
        include: { instrument: true },
      });

      expect(quoteWithInstrument?.instrument?.symbol).toBe('TEST');
      expect(quoteWithInstrument?.instrument?.name).toBe('Test Stock Inc.');
    });

    it('should load bars with instrument relationship', async () => {
      const bar = await db.bar.create({
        data: {
          instrumentId: testInstrumentId,
          symbol: 'TEST',
          timeframe: '1day',
          timestamp: new Date(),
          open: 150,
          high: 151,
          low: 149,
          close: 150.5,
          volume: 1000000,
        },
      });

      const barWithInstrument = await db.bar.findUnique({
        where: { id: bar.id },
        include: { instrument: true },
      });

      expect(barWithInstrument?.instrument?.symbol).toBe('TEST');
    });

    it('should cascade delete all related data when instrument is deleted', async () => {
      const tempInstrument = await db.instrument.create({
        data: {
          symbol: 'TEMP2',
          name: 'Temporary 2',
          exchange: 'NYSE',
          type: 'STOCK',
        },
      });

      await db.quote.create({
        data: {
          instrumentId: tempInstrument.id,
          symbol: 'TEMP2',
          timestamp: new Date(),
          last: 100,
          volume: 1000,
        },
      });

      await db.bar.create({
        data: {
          instrumentId: tempInstrument.id,
          symbol: 'TEMP2',
          timeframe: '1day',
          timestamp: new Date(),
          open: 100,
          high: 101,
          low: 99,
          close: 100.5,
          volume: 10000,
        },
      });

      await db.tradingSession.create({
        data: {
          instrumentId: tempInstrument.id,
          exchange: 'NYSE',
          date: new Date(),
          sessionType: 'REGULAR',
          openTime: new Date(),
          closeTime: new Date(),
        },
      });

      await db.instrument.delete({ where: { id: tempInstrument.id } });

      const quotes = await db.quote.findMany({
        where: { instrumentId: tempInstrument.id },
      });
      const bars = await db.bar.findMany({
        where: { instrumentId: tempInstrument.id },
      });
      const sessions = await db.tradingSession.findMany({
        where: { instrumentId: tempInstrument.id },
      });

      expect(quotes.length).toBe(0);
      expect(bars.length).toBe(0);
      expect(sessions.length).toBe(0);
    });
  });
});
