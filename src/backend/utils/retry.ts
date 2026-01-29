/**
 * Retry Utility with Exponential Backoff
 * Provides robust retry logic for transient failures
 */

import { logger } from '../../shared/logger';

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Base delay in milliseconds */
  baseDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Jitter factor (0-1) to add randomness */
  jitterFactor?: number;
  /** Function to determine if an error is retryable */
  isRetryable?: (error: any) => boolean;
  /** Function to be called before each retry attempt */
  onRetry?: (attempt: number, error: any, delay: number) => void;
  /** Function to be called on success */
  onSuccess?: (attempt: number) => void;
  /** Function to be called when all retries are exhausted */
  onFailed?: (error: any, attempts: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: any;
  attempts: number;
  totalDelay: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.1, // 10% jitter
  isRetryable: defaultIsRetryable,
  onRetry: () => {},
  onSuccess: () => {},
  onFailed: () => {}
};

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: any): boolean {
  if (!error) return false;

  // Check for common retryable error patterns
  const errorMessage = error.message || error.toString();
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /connection/i,
    /rate.*limit/i,
    /slow.*down/i,
    /temporarily.*unavailable/i,
    /service.*unavailable/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /502/i,  // Bad Gateway
    /503/i,  // Service Unavailable
    /504/i,  // Gateway Timeout
    /429/i,  // Too Many Requests
  ];

  // Check if error message contains retryable patterns
  const isRetryableMessage = retryablePatterns.some(pattern => pattern.test(errorMessage));

  // Check for specific error types
  const isRetryableType = error.name === 'NetworkError' ||
                        error.name === 'TimeoutError' ||
                        error.code === 'ECONNRESET' ||
                        error.code === 'ETIMEDOUT';

  // Check HTTP status codes
  const isRetryableStatus = error.status >= 500 || error.status === 429;

  return isRetryableMessage || isRetryableType || isRetryableStatus;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
  const exponentialDelay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  
  // Apply maximum limit
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  
  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * options.jitterFactor * Math.random();
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Success callback
      if (attempt > 1) {
        config.onSuccess(attempt);
      }
      
      logger.debug(`Operation succeeded on attempt ${attempt}`, {
        attempts: attempt,
        totalDelay
      }, 'retry');
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === config.maxAttempts || !config.isRetryable(error)) {
        // All retries exhausted or error is not retryable
        config.onFailed(error, attempt);
        
        logger.error(`Operation failed after ${attempt} attempt(s)`, {
          error: error.message || error,
          attempts: attempt,
          totalDelay,
          isRetryable: config.isRetryable(error)
        }, 'retry');
        
        throw error;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, config);
      totalDelay += delay;
      
      // Retry callback
      config.onRetry(attempt, error, delay);
      
      logger.warn(`Operation failed, retrying in ${delay}ms`, {
        attempt: attempt,
        maxAttempts: config.maxAttempts,
        error: error.message || error,
        delay: delay,
        nextAttempt: attempt + 1
      }, 'retry');
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Retry a function and return detailed result instead of throwing
 */
export async function retryWithResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  let totalDelay = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        config.onSuccess(attempt);
      }
      
      return {
        success: true,
        result,
        attempts: attempt,
        totalDelay
      };
    } catch (error) {
      lastError = error;
      
      if (attempt === config.maxAttempts || !config.isRetryable(error)) {
        config.onFailed(error, attempt);
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelay
        };
      }
      
      const delay = calculateDelay(attempt, config);
      totalDelay += delay;
      
      config.onRetry(attempt, error, delay);
      await sleep(delay);
    }
  }
  
  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalDelay
  };
}

/**
 * Sleep utility function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a retryable function wrapper
 */
export function createRetryable<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): () => Promise<T> {
  return () => withRetry(operation, options);
}

/**
 * Retry options for different operation types
 */
export const RetryPresets = {
  /** Conservative retry for critical operations */
  conservative: {
    maxAttempts: 2,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  },

  /** Standard retry for most operations */
  standard: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitterFactor: 0.1
  },

  /** Aggressive retry for non-critical operations */
  aggressive: {
    maxAttempts: 5,
    baseDelay: 500,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.2
  },

  /** Quick retry for fast operations */
  quick: {
    maxAttempts: 3,
    baseDelay: 100,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitterFactor: 0.05
  },

  /** Slow retry for bulk operations */
  slow: {
    maxAttempts: 2,
    baseDelay: 5000,
    maxDelay: 120000, // 2 minutes
    backoffMultiplier: 3,
    jitterFactor: 0.15
  }
};

/**
 * Circuit breaker aware retry
 * Combines retry logic with circuit breaker protection
 */
export async function withRetryAndCircuitBreaker<T>(
  operation: () => Promise<T>,
  circuitBreaker: any,
  options: RetryOptions = {}
): Promise<T> {
  return withRetry(async () => {
    return await circuitBreaker.execute(operation);
  }, options);
}

/**
 * Batch retry utility
 * Retries multiple operations independently
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results: Array<RetryResult<T>> = [];
  
  // Execute operations concurrently but with individual retry logic
  const promises = operations.map(async (operation, index) => {
    try {
      const result = await withRetry(operation, options);
      return {
        success: true as const,
        result,
        attempts: 1, // Note: This doesn't track actual retry attempts
        totalDelay: 0
      };
    } catch (error) {
      return {
        success: false as const,
        error,
        attempts: 1,
        totalDelay: 0
      };
    }
  });
  
  const batchResults = await Promise.allSettled(promises);
  
  return batchResults.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        error: result.reason,
        attempts: 1,
        totalDelay: 0
      };
    }
  });
}

/**
 *.Timeout wrapper for retry operations
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error(`Operation timed out after ${timeoutMs}ms`)
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(timeoutError), timeoutMs);
    })
  ]);
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(operation, timeoutMs),
    retryOptions
  );
}

// Export default retry function
export default withRetry;