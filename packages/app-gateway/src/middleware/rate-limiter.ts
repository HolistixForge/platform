import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { EPriority, log } from '@holistix-forge/log';
import { Request, Response } from 'express';

/**
 * Rate Limiter Configuration Module for Gateway
 * 
 * Provides tiered rate limiting for gateway endpoints to protect against
 * abuse and ensure fair resource allocation per organization.
 * 
 * Architecture:
 * - Uses in-memory store (sufficient for per-organization gateway instances)
 * - IP-based rate limiting (via X-Forwarded-For with trust proxy)
 * - Standard Rate Limit headers (RateLimit-* headers per RFC draft)
 * 
 * @see https://github.com/express-rate-limit/express-rate-limit
 * @see /doc/architecture/OVERVIEW.md
 */

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Custom handler for rate limit exceeded responses
 * Integrates with our logging and observability infrastructure
 */
const createRateLimitHandler = (limiterType: string) => {
  return (req: Request, res: Response) => {
    // Log to structured logger for observability
    log(
      EPriority.Warning,
      'RATE_LIMIT',
      `Rate limit exceeded [${limiterType}]: ${req.ip} on ${req.method} ${req.path}`
    );

    res.status(429).json({
      error: 'Too many requests, please try again later',
      retryAfter: res.getHeader('RateLimit-Reset'),
    });
  };
};

/**
 * Create a rate limiter with standard configuration
 */
const createRateLimiter = (
  config: RateLimiterConfig,
  limiterType: string
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    handler: createRateLimitHandler(limiterType),
  });
};

/**
 * Environment-based configuration with sensible defaults
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

// Window duration (default: 15 minutes)
const WINDOW_MS = getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

/**
 * OAuth endpoints - Strict limits for per-org OAuth
 * 
 * Protects against:
 * - Token farming
 * - Token validation spam
 * - Authorization abuse
 */
export const oauthLimiter = createRateLimiter(
  {
    windowMs: WINDOW_MS,
    max: getEnvNumber('RATE_LIMIT_OAUTH_MAX', 20),
    message: 'Too many token requests, please try again later',
  },
  'OAUTH'
);

/**
 * API endpoints - Generous for legitimate use
 * 
 * Protects against:
 * - Collaboration API abuse
 * - Permission check spam
 * - Protected services overload
 */
export const apiLimiter = createRateLimiter(
  {
    windowMs: WINDOW_MS,
    max: getEnvNumber('RATE_LIMIT_API_MAX', 100),
    message: 'API rate limit exceeded, please try again later',
  },
  'API'
);

/**
 * Global fallback - Very generous
 * 
 * Applied to all routes as a baseline protection
 * Prevents extreme abuse while allowing normal usage patterns
 */
export const globalLimiter = createRateLimiter(
  {
    windowMs: WINDOW_MS,
    max: getEnvNumber('RATE_LIMIT_GLOBAL_MAX', 500),
    message: 'Too many requests from this IP, please try again later',
  },
  'GLOBAL'
);

/**
 * Check if rate limiting is enabled
 * Can be disabled via environment variable for testing
 */
export const isRateLimitingEnabled = (): boolean => {
  return process.env.RATE_LIMIT_ENABLED !== 'false';
};
