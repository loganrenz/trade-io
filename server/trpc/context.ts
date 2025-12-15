/**
 * tRPC Context
 * Provides request-scoped data to all procedures
 */
import type { H3Event } from 'h3';
import { logger } from '../lib/logger';
import { db } from '../lib/db';

export async function createContext(event: H3Event) {
  const requestId = crypto.randomUUID();
  const ipAddress = getRequestIP(event, { xForwardedFor: true });
  const userAgent = getRequestHeader(event, 'user-agent');

  // Extract user ID from session/JWT (to be implemented with Supabase Auth)
  const userId: string | null = null; // TODO: Extract from auth header

  return {
    userId,
    requestId,
    ipAddress,
    userAgent,
    logger: logger.child({ requestId }),
    db, // Add database client to context
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
