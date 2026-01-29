/**
 * Circuit Breaker Pattern Implementation
 * Provides fault tolerance for external service calls (S3 operations)
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject calls
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in milliseconds to wait before transitioning from OPEN to HALF_OPEN */
  recoveryTimeout?: number;
  /** Time in milliseconds to wait before transitioning from HALF_OPEN to CLOSED */
  halfOpenTimeout?: number;
  /** Reset timeout for successful operations in HALF_OPEN state */
  successThreshold?: number;
  /** Monitoring period for failure rate calculation */
  monitoringPeriod?: number;
  /** Name of the circuit breaker for monitoring */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttemptTime?: number;
  failureRate: number;
  totalRequests: number;
}

/**
 * Circuit Breaker Class
 * Implements the circuit breaker pattern for fault tolerance
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private nextAttemptTime: number = 0;
  private requestTimestamps: number[] = [];
  
  private readonly options: Required<CircuitBreakerOptions>;
  private readonly stats: CircuitBreakerStats;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      halfOpenTimeout: options.halfOpenTimeout || 30000,  // 30 seconds
      successThreshold: options.successThreshold || 3,
      monitoringPeriod: options.monitoringPeriod || 300000, // 5 minutes
      name: options.name || 'unnamed'
    };

    this.stats = {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      failureRate: 0,
      totalRequests: 0
    };
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const now = Date.now();
    
    // Clean old request timestamps
    this.cleanupOldTimestamps(now);
    
    // Check if we can execute the operation
    if (!this.canExecute(now)) {
      if (fallback) {
        return await fallback();
      }
      throw new Error(`Circuit breaker is ${this.state}. Rejecting request.`);
    }

    this.stats.totalRequests++;
    
    try {
      const result = await operation();
      this.onSuccess(now);
      return result;
    } catch (error) {
      this.onFailure(now);
      
      if (fallback && this.state === CircuitState.OPEN) {
        try {
          return await fallback();
        } catch (fallbackError) {
          throw error; // Throw original error if fallback also fails
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if operation can be executed based on circuit state
   */
  private canExecute(now: number): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        // Check failure rate in monitoring period
        const recentFailures = this.getRecentFailures(now);
        return recentFailures < this.options.failureThreshold;
        
      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        return now >= this.nextAttemptTime;
        
      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(now: number): void {
    this.successes++;
    this.lastSuccessTime = now;
    this.requestTimestamps.push(now);

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // If we've had enough successes in half-open, close the circuit
        if (this.successes >= this.options.successThreshold) {
          this.setState(CircuitState.CLOSED, now);
        }
        break;
        
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = Math.max(0, this.failures - 1);
        break;
    }

    this.updateStats();
  }

  /**
   * Handle failed operation
   */
  private onFailure(now: number): void {
    this.failures++;
    this.lastFailureTime = now;
    this.requestTimestamps.push(now);

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Any failure in half-open opens the circuit immediately
        this.setState(CircuitState.OPEN, now);
        break;
        
      case CircuitState.CLOSED:
        // Check if we've exceeded failure threshold
        if (this.failures >= this.options.failureThreshold) {
          this.setState(CircuitState.OPEN, now);
        }
        break;
        
      case CircuitState.OPEN:
        // Already open, just update next attempt time
        this.nextAttemptTime = now + this.options.recoveryTimeout;
        break;
    }

    this.updateStats();
  }

  /**
   * Set circuit state and update related properties
   */
  private setState(state: CircuitState, now: number): void {
    const previousState = this.state;
    this.state = state;

    switch (state) {
      case CircuitState.OPEN:
        this.nextAttemptTime = now + this.options.recoveryTimeout;
        console.warn(`Circuit breaker '${this.options.name}' opened due to ${this.failures} failures`);
        break;
        
      case CircuitState.HALF_OPEN:
        this.successes = 0; // Reset success counter for half-open
        this.nextAttemptTime = now + this.options.halfOpenTimeout;
        console.info(`Circuit breaker '${this.options.name}' entered half-open state`);
        break;
        
      case CircuitState.CLOSED:
        this.failures = 0;
        this.nextAttemptTime = 0;
        console.info(`Circuit breaker '${this.options.name}' closed`);
        break;
    }

    this.stats.state = state;
    this.stats.lastFailureTime = this.lastFailureTime || undefined;
    this.stats.lastSuccessTime = this.lastSuccessTime || undefined;
    this.stats.nextAttemptTime = this.nextAttemptTime || undefined;
  }

  /**
   * Get number of recent failures within monitoring period
   */
  private getRecentFailures(now: number): number {
    const cutoff = now - this.options.monitoringPeriod;
    return this.requestTimestamps.filter(timestamp => timestamp >= cutoff).length;
  }

  /**
   * Clean up old timestamps outside monitoring period
   */
  private cleanupOldTimestamps(now: number): void {
    const cutoff = now - this.options.monitoringPeriod;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp >= cutoff);
  }

  /**
   * Update circuit breaker statistics
   */
  private updateStats(): void {
    this.stats.failures = this.failures;
    this.stats.successes = this.successes;
    this.stats.failureRate = this.stats.totalRequests > 0 
      ? (this.failures / this.stats.totalRequests) * 100 
      : 0;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.setState(CircuitState.CLOSED, Date.now());
    this.requestTimestamps = [];
    this.stats.totalRequests = 0;
    console.info(`Circuit breaker '${this.options.name}' manually reset`);
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is currently allowing requests
   */
  isAvailable(): boolean {
    return this.canExecute(Date.now());
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerRegistry {
  private static instance: CircuitBreakerRegistry;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {}

  public static getInstance(): CircuitBreakerRegistry {
    if (!CircuitBreakerRegistry.instance) {
      CircuitBreakerRegistry.instance = new CircuitBreakerRegistry();
    }
    return CircuitBreakerRegistry.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(name, new CircuitBreaker({ ...options, name }));
    }
    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.circuitBreakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get names of all circuit breakers
   */
  getNames(): string[] {
    return Array.from(this.circuitBreakers.keys());
  }
}

// Export singleton instances
export const circuitBreakerRegistry = CircuitBreakerRegistry.getInstance();
export const s3CircuitBreaker = circuitBreakerRegistry.getCircuitBreaker('s3-operations', {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  halfOpenTimeout: 30000,
  successThreshold: 3,
  monitoringPeriod: 300000
});