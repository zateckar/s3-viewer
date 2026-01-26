/**
 * Timer Manager Utility
 * Prevents memory leaks by managing all timers and intervals centrally
 * Provides cleanup methods for components with timers
 */

export interface TimerInfo {
  id: number | NodeJS.Timeout;
  type: 'timeout' | 'interval';
  callback: Function;
  delay: number;
  createdAt: number;
  context?: string;
}

export class TimerManager {
  private static instance: TimerManager;
  private timers: Map<string, TimerInfo> = new Map();
  private timerIdCounter: number = 0;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): TimerManager {
    if (!TimerManager.instance) {
      TimerManager.instance = new TimerManager();
    }
    return TimerManager.instance;
  }

  /**
   * Create a managed timeout
   */
  setTimeout(callback: Function, delay: number, context?: string): string {
    const timerId = `timeout_${++this.timerIdCounter}`;
    const nativeTimerId = setTimeout(() => {
      this.clearTimer(timerId);
      try {
        callback();
      } catch (error) {
        console.error('Error in timeout callback:', error);
      }
    }, delay);

    const timerInfo: TimerInfo = {
      id: nativeTimerId,
      type: 'timeout',
      callback,
      delay,
      createdAt: Date.now(),
      context
    };

    this.timers.set(timerId, timerInfo);
    return timerId;
  }

  /**
   * Create a managed interval
   */
  setInterval(callback: Function, delay: number, context?: string): string {
    const timerId = `interval_${++this.timerIdCounter}`;
    const nativeTimerId = setInterval(() => {
      try {
        callback();
      } catch (error) {
        console.error('Error in interval callback:', error);
      }
    }, delay);

    const timerInfo: TimerInfo = {
      id: nativeTimerId,
      type: 'interval',
      callback,
      delay,
      createdAt: Date.now(),
      context
    };

    this.timers.set(timerId, timerInfo);
    return timerId;
  }

  /**
   * Clear a specific timer
   */
  clearTimer(timerId: string): boolean {
    const timerInfo = this.timers.get(timerId);
    if (!timerInfo) {
      return false;
    }

    if (timerInfo.type === 'timeout') {
      clearTimeout(timerInfo.id as number);
    } else {
      clearInterval(timerInfo.id as NodeJS.Timeout);
    }

    this.timers.delete(timerId);
    return true;
  }

  /**
   * Clear all timers
   */
  clearAllTimers(): number {
    let clearedCount = 0;
    for (const timerId of this.timers.keys()) {
      if (this.clearTimer(timerId)) {
        clearedCount++;
      }
    }
    return clearedCount;
  }

  /**
   * Clear timers by context
   */
  clearTimersByContext(context: string): number {
    let clearedCount = 0;
    const timersToClear: string[] = [];

    for (const [timerId, timerInfo] of this.timers.entries()) {
      if (timerInfo.context === context) {
        timersToClear.push(timerId);
      }
    }

    for (const timerId of timersToClear) {
      if (this.clearTimer(timerId)) {
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get timer information
   */
  getTimerInfo(timerId: string): TimerInfo | undefined {
    return this.timers.get(timerId);
  }

  /**
   * Get all timers
   */
  getAllTimers(): Map<string, TimerInfo> {
    return new Map(this.timers);
  }

  /**
   * Get timers by context
   */
  getTimersByContext(context: string): Map<string, TimerInfo> {
    const result = new Map<string, TimerInfo>();
    for (const [timerId, timerInfo] of this.timers.entries()) {
      if (timerInfo.context === context) {
        result.set(timerId, timerInfo);
      }
    }
    return result;
  }

  /**
   * Get active timer count
   */
  getActiveTimerCount(): number {
    return this.timers.size;
  }

  /**
   * Get timer statistics
   */
  getStats(): {
    total: number;
    timeouts: number;
    intervals: number;
    byContext: Record<string, number>;
    oldestTimer: number;
    averageAge: number;
  } {
    const now = Date.now();
    let timeouts = 0;
    let intervals = 0;
    const byContext: Record<string, number> = {};
    let oldestTimer = now;
    let totalAge = 0;

    for (const timerInfo of this.timers.values()) {
      if (timerInfo.type === 'timeout') {
        timeouts++;
      } else {
        intervals++;
      }

      if (timerInfo.context) {
        byContext[timerInfo.context] = (byContext[timerInfo.context] || 0) + 1;
      }

      oldestTimer = Math.min(oldestTimer, timerInfo.createdAt);
      totalAge += (now - timerInfo.createdAt);
    }

    return {
      total: this.timers.size,
      timeouts,
      intervals,
      byContext,
      oldestTimer,
      averageAge: this.timers.size > 0 ? totalAge / this.timers.size : 0
    };
  }

  /**
   * Check for potential issues (long-running timers, etc.)
   */
  checkForIssues(): Array<{
    type: string;
    description: string;
    timerId: string;
    severity: 'warning' | 'error';
  }> {
    const issues: Array<{
      type: string;
      description: string;
      timerId: string;
      severity: 'warning' | 'error';
    }> = [];

    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    const veryLongRunning = 600000; // 10 minutes

    for (const [timerId, timerInfo] of this.timers.entries()) {
      const age = now - timerInfo.createdAt;

      // Check for very long running timers
      if (age > veryLongRunning) {
        issues.push({
          type: 'very_long_running',
          description: `Timer has been running for ${Math.round(age / 1000)} seconds`,
          timerId,
          severity: 'warning'
        });
      }

      // Check for potentially forgotten intervals
      if (timerInfo.type === 'interval' && age > maxAge) {
        issues.push({
          type: 'long_running_interval',
          description: `Interval may have been forgotten (running for ${Math.round(age / 1000)} seconds)`,
          timerId,
          severity: 'warning'
        });
      }

      // Check for very short intervals (potential performance issues)
      if (timerInfo.type === 'interval' && timerInfo.delay < 100) {
        issues.push({
          type: 'very_frequent_interval',
          description: `Very frequent interval (${timerInfo.delay}ms) may impact performance`,
          timerId,
          severity: 'warning'
        });
      }
    }

    return issues;
  }
}

/**
 * Component with Timers Mixin
 * Provides timer management for components that use timers
 */
export abstract class ComponentWithTimers {
  protected timerManager: TimerManager;
  protected componentId: string;
  protected timerIds: string[] = [];

  constructor(componentId: string) {
    this.timerManager = TimerManager.getInstance();
    this.componentId = componentId;
  }

  /**
   * Create a timeout for this component
   */
  protected setTimeout(callback: Function, delay: number): string {
    const timerId = this.timerManager.setTimeout(callback, delay, this.componentId);
    this.timerIds.push(timerId);
    return timerId;
  }

  /**
   * Create an interval for this component
   */
  protected setInterval(callback: Function, delay: number): string {
    const timerId = this.timerManager.setInterval(callback, delay, this.componentId);
    this.timerIds.push(timerId);
    return timerId;
  }

  /**
   * Clear a specific timer
   */
  protected clearTimeout(timerId: string): boolean {
    const index = this.timerIds.indexOf(timerId);
    if (index > -1) {
      this.timerIds.splice(index, 1);
    }
    return this.timerManager.clearTimer(timerId);
  }

  /**
   * Clear a specific interval
   */
  protected clearInterval(timerId: string): boolean {
    const index = this.timerIds.indexOf(timerId);
    if (index > -1) {
      this.timerIds.splice(index, 1);
    }
    return this.timerManager.clearTimer(timerId);
  }

  /**
   * Clear all timers for this component
   */
  protected clearAllTimers(): number {
    let clearedCount = 0;
    for (const timerId of this.timerIds) {
      if (this.timerManager.clearTimer(timerId)) {
        clearedCount++;
      }
    }
    this.timerIds = [];
    return clearedCount;
  }

  /**
   * Get active timer count for this component
   */
  protected getActiveTimerCount(): number {
    return this.timerIds.length;
  }

  /**
   * Cleanup method to be called when component is destroyed
   */
  public cleanup(): void {
    this.clearAllTimers();
  }

  /**
   * Get timer statistics for this component
   */
  public getTimerStats(): {
    active: number;
    byType: { timeouts: number; intervals: number };
  } {
    let timeouts = 0;
    let intervals = 0;

    for (const timerId of this.timerIds) {
      const timerInfo = this.timerManager.getTimerInfo(timerId);
      if (timerInfo) {
        if (timerInfo.type === 'timeout') {
          timeouts++;
        } else {
          intervals++;
        }
      }
    }

    return {
      active: this.timerIds.length,
      byType: { timeouts, intervals }
    };
  }
}

/**
 * Browser-specific TimerManager wrapper
 */
export class BrowserTimerManager {
  private static instance: BrowserTimerManager;
  private componentManagers: Map<string, ComponentWithTimers> = new Map();

  private constructor() {}

  static getInstance(): BrowserTimerManager {
    if (!BrowserTimerManager.instance) {
      BrowserTimerManager.instance = new BrowserTimerManager();
    }
    return BrowserTimerManager.instance;
  }

  /**
   * Register a component
   */
  registerComponent(componentId: string): void {
    const manager = new (class extends ComponentWithTimers {
      constructor(id: string) {
        super(id);
      }
    })(componentId);
    
    this.componentManagers.set(componentId, manager);
  }

  /**
   * Get component manager
   */
  getComponentManager(componentId: string): ComponentWithTimers | undefined {
    return this.componentManagers.get(componentId);
  }

  /**
   * Unregister and cleanup a component
   */
  unregisterComponent(componentId: string): void {
    const manager = this.componentManagers.get(componentId);
    if (manager) {
      manager.cleanup();
      this.componentManagers.delete(componentId);
    }
  }

  /**
   * Cleanup all components
   */
  cleanupAll(): void {
    for (const componentId of this.componentManagers.keys()) {
      this.unregisterComponent(componentId);
    }
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    components: number;
    totalTimers: number;
    componentDetails: Array<{
      componentId: string;
      activeTimers: number;
      timerTypes: { timeouts: number; intervals: number };
    }>;
  } {
    const componentDetails: Array<{
      componentId: string;
      activeTimers: number;
      timerTypes: { timeouts: number; intervals: number };
    }> = [];

    let totalTimers = 0;

    for (const [componentId, manager] of this.componentManagers.entries()) {
      const stats = manager.getTimerStats();
      totalTimers += stats.active;
      
      componentDetails.push({
        componentId,
        activeTimers: stats.active,
        timerTypes: stats.byType
      });
    }

    return {
      components: this.componentManagers.size,
      totalTimers,
      componentDetails
    };
  }
}

// Global cleanup for page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    TimerManager.getInstance().clearAllTimers();
    BrowserTimerManager.getInstance().cleanupAll();
  });
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).TimerManager = TimerManager;
  (window as any).BrowserTimerManager = BrowserTimerManager;
}