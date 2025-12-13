/**
 * CORS and Security Headers Configuration
 * Security headers for API responses
 */

/**
 * CORS configuration
 */
export const corsConfig = {
  origin: process.env['CORS_ORIGIN'] || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

/**
 * Security headers
 */
export const securityHeaders = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Strict transport security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

  // Content Security Policy
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(headers: Record<string, string>): void {
  Object.assign(headers, securityHeaders);
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;

  const allowedOrigin = corsConfig.origin;

  if (allowedOrigin === '*') {
    return true;
  }

  if (typeof allowedOrigin === 'string') {
    return origin === allowedOrigin;
  }

  if (Array.isArray(allowedOrigin)) {
    return allowedOrigin.includes(origin);
  }

  return false;
}
