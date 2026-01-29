/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm for API rate limiting
 * Provides IP-based and user-based rate limiting with configurable limits
 */

import { logger } from '../../shared/logger';

export interface RateLimitOptions {
  /** Maximum requests per window */
  requestsPerWindow?: number;
  /** Time window in milliseconds */
  windowMs?: number;
  /** Whether to use IP-based limiting */
  byIP?: boolean;
  /** Whether to use user-based limiting */
  byUser?: boolean;
  /** Custom key generator function */
  keyGenerator?: (request: Request) => Promise<string>;
  /** Custom skip function */
  skip?: (request: Request) => Promise<boolean>;
  /** Custom success message */
  successMessage?: string;
  /** Custom error message */
  errorMessage?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate Limiter Class
 * Implements token bucket algorithm with memory-efficient storage
 */
export class RateLimiter {
  private readonly options: Required<RateLimitOptions>;
  private readonly buckets: Map<string, TokenBucket> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimitOptions = {}) {
    this.options = {
      requestsPerWindow: options.requestsPerWindow || 100,
      windowMs: options.windowMs || 60000, // 1 minute
      byIP: options.byIP !== false,
      byUser: options.byUser || false,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator.bind(this),
      skip: options.skip || (() => Promise.resolve(false)),
      successMessage: options.successMessage || 'Rate limit OK',
      errorMessage: options.errorMessage || 'Rate limit exceeded'
    };

    // Cleanup old buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info('Rate limiter initialized', this.options, 'rate-limit');
  }

  /**
   * Default key generator - combines IP and user ID
   */
  private async defaultKeyGenerator(request: Request): Promise<string> {
    const parts: string[] = [];

    if (this.options.byIP) {
      const ip = this.getClientIP(request);
      if (ip) parts.push(`ip:${ip}`);
    }

    if (this.options.byUser) {
      // Try to get user ID from JWT token
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
          if (payload.sub) parts.push(`user:${payload.sub}`);
        } catch (error) {
          // Ignore JWT parsing errors for rate limiting
        }
      }
    }

    return parts.join(':') || 'anonymous';
  }

  /**
   * Get client IP from request
   */
  private getClientIP(request: Request): string | null {
    // Try various headers for real IP
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip',
      'x-client-ip',
      'x-forwarded',
      'forwarded-for',
      'forwarded'
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        const ip = value.split(',')[0].trim();
        if (ip && ip !== 'unknown') {
          return ip;
        }
      }
    }

    // For requests without headers, we'd need the server's request object
    // This is a limitation in the current setup
    return null;
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(request: Request): Promise<RateLimitResult> {
    // Check if we should skip rate limiting
    if (await this.options.skip(request)) {
      return {
        allowed: true,
        limit: this.options.requestsPerWindow,
        remaining: this.options.requestsPerWindow,
        resetTime: Date.now() + this.options.windowMs
      };
    }

    const key = await this.options.keyGenerator(request);
    const now = Date.now();
    
    // Get or create bucket
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.options.requestsPerWindow,
        lastRefill: now
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timeElapsed / this.options.windowMs) * this.options.requestsPerWindow);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.options.requestsPerWindow, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if request is allowed
    const allowed = bucket.tokens > 0;
    
    if (allowed) {
      bucket.tokens--;
    }

    const resetTime = bucket.lastRefill + this.options.windowMs;

    return {
      allowed,
      limit: this.options.requestsPerWindow,
      remaining: Math.max(0, bucket.tokens),
      resetTime,
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  /**
   * Clean up old buckets to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - (2 * this.options.windowMs); // Keep buckets for 2 windows
    
    let cleaned = 0;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.lastRefill < cutoff) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit buckets`, { totalBuckets: this.buckets.size }, 'rate-limit');
    }
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): { totalBuckets: number; options: Required<RateLimitOptions> } {
    return {
      totalBuckets: this.buckets.size,
      options: this.options
    };
  }

  /**
   * Reset specific bucket
   */
  resetBucket(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all buckets
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Destroy rate limiter and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

/**
 * Rate Limiting Middleware Factory
 * Creates middleware function for use in request handlers
 */
export function createRateLimitMiddleware(options: RateLimitOptions = {}) {
  const rateLimiter = new RateLimiter(options);

  return async function rateLimitMiddleware(request: Request): Promise<{ response?: Response; next?: boolean }> {
    try {
      const result = await rateLimiter.checkLimit(request);

      // Add rate limit headers
      const headers: Record<string, string> = {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      };

      if (result.retryAfter) {
        headers['Retry-After'] = result.retryAfter.toString();
      }

      // Check if request is allowed
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', {
          limit: result.limit,
          remaining: result.remaining,
          retryAfter: result.retryAfter
        }, 'rate-limit');

        return {
          response: new Response(JSON.stringify({
            error: rateLimiter.options.errorMessage,
            retryAfter: result.retryAfter,
            limit: result.limit,
            remaining: result.remaining
          }), {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            }
          })
        };
      }

      // Store headers to be added to successful response
      (request as any).rateLimitHeaders = headers;
      return { next: true };

    } catch (error) {
      logger.error('Rate limiting error', error, 'rate-limit');
      // On error, allow the request but log the issue
      return { next: true };
    }
  };
}

/**
 * Apply rate limit headers to response
 */
export function applyRateLimitHeaders(response: Response, request: Request): Response {
  const headers = (request as any).rateLimitHeaders;
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  return response;
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /** Strict rate limiting for authentication endpoints */
  auth: {
    requestsPerWindow: 5,
    windowMs: 60000, // 5 requests per minute
    byIP: true,
    byUser: false,
    errorMessage: 'Too many authentication attempts, please try again later'
  },

  /** Moderate rate limiting for file operations */
  fileOperations: {
    requestsPerWindow: 50,
    windowMs: 60000, // 50 requests per minute
    byIP: true,
    byUser: true,
    errorMessage: 'Too many file operations, please slow down'
  },

  /** Lenient rate limiting for general API calls */
  general: {
    requestsPerWindow: 100,
    windowMs: 60000, // 100 requests per minute
    byIP: true,
    byUser: true,
    errorMessage: 'Rate limit exceeded'
  },

  /** Very strict rate limiting for upload operations */
  uploads: {
    requestsPerWindow: 10,
    windowMs: 60000, // 10 uploads per minute
    byIP: true,
    byUser: true,
    errorMessage: 'Too many upload attempts, please wait before uploading more files'
  }
};

// Export default rate limiter instance
export const defaultRateLimiter = new RateLimiter(RateLimitPresets.general);
export const authRateLimiter = new RateLimiter(RateLimitPresets.auth);
export const fileOpsRateLimiter = new RateLimiter(RateLimitPresets.fileOperations);
export const uploadRateLimiter = new RateLimiter(RateLimitPresets.uploads);

/**
 * Convenience middleware functions
 */
export const authRateLimit = createRateLimitMiddleware(RateLimitPresets.auth);
export const fileOpsRateLimit = createRateLimitMiddleware(RateLimitPresets.fileOperations);
export const uploadRateLimit = createRateLimitMiddleware(RateLimitPresets.uploads);
export const generalRateLimit = createRateLimitMiddleware(RateLimitPresets.general);