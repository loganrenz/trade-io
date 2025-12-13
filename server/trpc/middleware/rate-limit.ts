/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API endpoints
 */
import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

/**
 * Rate limiting middleware
 */
export function createRateLimitMiddleware(config: {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}) {
  return middleware(async ({ ctx, next }) => {
    const key = `${config.keyPrefix || 'default'}:${ctx.userId || ctx.ipAddress}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry
      entry = {
        count: 1,
        resetAt: now + config.windowMs,
      };
      rateLimitStore.set(key, entry);
      return next();
    }

    if (entry.count >= config.maxRequests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds`,
      });
    }

    entry.count++;
    return next();
  });
}

/**
 * Pre-configured rate limiters
 */

// General API - 1000 requests per minute
export const generalRateLimit = createRateLimitMiddleware({
  maxRequests: 1000,
  windowMs: 60 * 1000,
  keyPrefix: 'general',
});

// Order placement - 100 requests per minute
export const orderRateLimit = createRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60 * 1000,
  keyPrefix: 'order',
});

// Authentication - 5 requests per minute
export const authRateLimit = createRateLimitMiddleware({
  maxRequests: 5,
  windowMs: 60 * 1000,
  keyPrefix: 'auth',
});
