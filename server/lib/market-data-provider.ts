/**
 * Market Data Provider Interface
 * Abstract interface for market data providers (Polygon, Alpha Vantage, etc.)
 */

export interface Quote {
  symbol: string;
  timestamp: Date;
  bid?: number;
  ask?: number;
  last: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

export interface Bar {
  symbol: string;
  timestamp: Date;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  trades?: number;
}

export interface MarketDataProvider {
  /**
   * Get latest quote for a symbol
   */
  getQuote(symbol: string): Promise<Quote | null>;

  /**
   * Get historical quotes
   */
  getQuoteHistory(symbol: string, startDate: Date, endDate: Date): Promise<Quote[]>;

  /**
   * Get OHLCV bars
   */
  getBars(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<Bar[]>;

  /**
   * Subscribe to real-time quotes (for future WebSocket implementation)
   */
  subscribeQuotes?(symbols: string[], callback: (quote: Quote) => void): void;

  /**
   * Unsubscribe from real-time quotes
   */
  unsubscribeQuotes?(symbols: string[]): void;
}

/**
 * Mock Market Data Provider (for development/testing)
 */
export class MockMarketDataProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<Quote | null> {
    // Generate mock quote
    const basePrice = 100 + Math.random() * 100;
    return {
      symbol,
      timestamp: new Date(),
      bid: basePrice - 0.1,
      ask: basePrice + 0.1,
      last: basePrice,
      volume: Math.floor(Math.random() * 1000000),
      high: basePrice + Math.random() * 5,
      low: basePrice - Math.random() * 5,
      open: basePrice + Math.random() * 2 - 1,
      close: basePrice - Math.random() * 2 + 1,
    };
  }

  async getQuoteHistory(symbol: string, startDate: Date, endDate: Date): Promise<Quote[]> {
    const quotes: Quote[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs);

    let basePrice = 100 + Math.random() * 100;

    for (let i = 0; i < Math.min(days, 100); i++) {
      const timestamp = new Date(startDate.getTime() + i * dayMs);
      basePrice += (Math.random() - 0.5) * 5;

      quotes.push({
        symbol,
        timestamp,
        last: basePrice,
        volume: Math.floor(Math.random() * 1000000),
        high: basePrice + Math.random() * 3,
        low: basePrice - Math.random() * 3,
        open: basePrice,
        close: basePrice,
      });
    }

    return quotes;
  }

  async getBars(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<Bar[]> {
    const bars: Bar[] = [];
    const intervalMs = this.getIntervalMs(timeframe);
    const count = Math.min(
      Math.floor((endDate.getTime() - startDate.getTime()) / intervalMs),
      1000
    );

    let basePrice = 100 + Math.random() * 100;

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(startDate.getTime() + i * intervalMs);
      const open = basePrice;
      const high = open + Math.random() * 2;
      const low = open - Math.random() * 2;
      const close = open + (Math.random() - 0.5) * 3;
      basePrice = close;

      bars.push({
        symbol,
        timestamp,
        timeframe,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 100000),
        vwap: (open + high + low + close) / 4,
        trades: Math.floor(Math.random() * 1000),
      });
    }

    return bars;
  }

  private getIntervalMs(timeframe: string): number {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[timeframe] || 60 * 1000;
  }
}

/**
 * Market Data Provider Factory
 */
export function createMarketDataProvider(): MarketDataProvider {
  const provider = process.env['MARKET_DATA_PROVIDER'] || 'mock';

  switch (provider) {
    case 'mock':
      return new MockMarketDataProvider();
    // Future providers:
    // case 'polygon':
    //   return new PolygonMarketDataProvider();
    // case 'alphavantage':
    //   return new AlphaVantageMarketDataProvider();
    default:
      return new MockMarketDataProvider();
  }
}

// Singleton instance
export const marketDataProvider = createMarketDataProvider();
