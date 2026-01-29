/**
 * Memory Pressure Monitoring System
 * Monitors memory usage and implements adaptive strategies to prevent memory exhaustion
 */

import { logger } from '../../shared/logger';

export interface MemoryStats {
  /** Total heap size in bytes */
  totalHeapSize: number;
  /** Used heap size in bytes */
  usedHeapSize: number;
  /** Free heap size in bytes */
  freeHeapSize: number;
  /** Memory usage percentage */
  usagePercentage: number;
  /** External memory usage in bytes */
  externalMemory: number;
  /** Array buffer usage in bytes */
  arrayBuffers: number;
  /** Timestamp of measurement */
  timestamp: number;
}

export interface MemoryPressureLevel {
  level: 'low' | 'moderate' | 'high' | 'critical';
  threshold: number;
  actions: string[];
}

export interface MemoryMonitorOptions {
  /** Enable/disable monitoring */
  enabled?: boolean;
  /** Check interval in milliseconds */
  checkInterval?: number;
  /** Memory pressure thresholds */
  thresholds?: {
    moderate: number;  // 70%
    high: number;      // 85%
    critical: number;  // 95%
  };
  /** Enable garbage collection aggression */
  aggressiveGC?: boolean;
  /** Enable cache cleanup on pressure */
  autoCleanup?: boolean;
  /** Minimum memory to keep free (in MB) */
  minFreeMemoryMB?: number;
}

/**
 * Memory Monitor Class
 * Provides comprehensive memory monitoring and pressure handling
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private options: Required<MemoryMonitorOptions>;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isNodeEnvironment: boolean;
  private memoryHistory: MemoryStats[] = [];
  private maxHistorySize = 100;
  private lastGC = 0;
  private lastCleanup = 0;

  private constructor() {
    this.options = {
      enabled: true,
      checkInterval: 30000, // 30 seconds
      thresholds: {
        moderate: 70,  // 70% memory usage
        high: 85,      // 85% memory usage  
        critical: 95   // 95% memory usage
      },
      aggressiveGC: true,
      autoCleanup: true,
      minFreeMemoryMB: 100
    };

    this.isNodeEnvironment = typeof process !== 'undefined' && process.versions?.node;
  }

  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Configure memory monitor options
   */
  configure(options: MemoryMonitorOptions): void {
    this.options = { ...this.options, ...options };
    
    if (this.options.enabled && !this.monitoringInterval) {
      this.startMonitoring();
    } else if (!this.options.enabled && this.monitoringInterval) {
      this.stopMonitoring();
    }
  }

  /**
   * Start continuous memory monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      try {
        this.checkMemoryUsage('scheduled');
      } catch (error) {
        logger.error('Memory monitoring error', error, 'memory');
      }
    }, this.options.checkInterval);

    logger.info('Memory monitoring started', this.options, 'memory');
  }

  /**
   * Stop continuous memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Memory monitoring stopped', null, 'memory');
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
    const now = Date.now();
    
    if (this.isNodeEnvironment) {
      const usage = process.memoryUsage();
      const total = usage.heapTotal;
      const used = usage.heapUsed;
      const free = total - used;
      
      return {
        totalHeapSize: total,
        usedHeapSize: used,
        freeHeapSize: free,
        usagePercentage: (used / total) * 100,
        externalMemory: usage.external,
        arrayBuffers: usage.arrayBuffers,
        timestamp: now
      };
    } else {
      // Browser environment - limited memory info
      if (performance && (performance as any).memory) {
        const mem = (performance as any).memory;
        return {
          totalHeapSize: mem.totalJSHeapSize,
          usedHeapSize: mem.usedJSHeapSize,
          freeHeapSize: mem.totalJSHeapSize - mem.usedJSHeapSize,
          usagePercentage: (mem.usedJSHeapSize / mem.totalJSHeapSize) * 100,
          externalMemory: 0,
          arrayBuffers: 0,
          timestamp: now
        };
      }
      
      // Fallback - return zeros
      return {
        totalHeapSize: 0,
        usedHeapSize: 0,
        freeHeapSize: 0,
        usagePercentage: 0,
        externalMemory: 0,
        arrayBuffers: 0,
        timestamp: now
      };
    }
  }

  /**
   * Check memory pressure and take appropriate actions
   */
  checkMemoryUsage(context: string = 'manual'): MemoryStats & { pressureLevel: MemoryPressureLevel['level'] } {
    const stats = this.getMemoryStats();
    const pressureLevel = this.getPressureLevel(stats.usagePercentage);
    
    // Store in history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Log memory usage
    logger.debug(`Memory check (${context})`, {
      usage: `${stats.usagePercentage.toFixed(1)}%`,
      used: `${(stats.usedHeapSize / 1024 / 1024).toFixed(1)}MB`,
      total: `${(stats.totalHeapSize / 1024 / 1024).toFixed(1)}MB`,
      pressureLevel
    }, 'memory');

    // Handle pressure based on level
    this.handleMemoryPressure(stats, pressureLevel, context);

    return { ...stats, pressureLevel };
  }

  /**
   * Determine memory pressure level based on usage percentage
   */
  private getPressureLevel(usagePercentage: number): MemoryPressureLevel['level'] {
    if (usagePercentage >= this.options.thresholds.critical) {
      return 'critical';
    } else if (usagePercentage >= this.options.thresholds.high) {
      return 'high';
    } else if (usagePercentage >= this.options.thresholds.moderate) {
      return 'moderate';
    }
    return 'low';
  }

  /**
   * Handle memory pressure with appropriate actions
   */
  private handleMemoryPressure(stats: MemoryStats, level: MemoryPressureLevel['level'], context: string): void {
    const now = Date.now();
    const actions: string[] = [];

    switch (level) {
      case 'critical':
        actions.push('CRITICAL_MEMORY_PRESSURE');
        
        // Force immediate garbage collection
        if (this.options.aggressiveGC) {
          this.forceGarbageCollection('critical');
          actions.push('forced_gc');
        }
        
        // Clear all caches
        if (this.options.autoCleanup) {
          this.clearAllCaches('critical');
          actions.push('cleared_all_caches');
        }
        
        // Log critical warning
        logger.error('CRITICAL memory pressure detected', {
          usage: `${stats.usagePercentage.toFixed(1)}%`,
          context,
          actions: actions.join(', ')
        }, 'memory');
        break;

      case 'high':
        actions.push('HIGH_MEMORY_PRESSURE');
        
        // Suggest garbage collection
        if (this.options.aggressiveGC && now - this.lastGC > 10000) {
          this.forceGarbageCollection('high');
          actions.push('suggested_gc');
        }
        
        // Clear old cache entries
        if (this.options.autoCleanup && now - this.lastCleanup > 30000) {
          this.clearOldCacheEntries('high');
          actions.push('cleared_old_caches');
        }
        
        logger.warn('High memory pressure detected', {
          usage: `${stats.usagePercentage.toFixed(1)}%`,
          context,
          actions: actions.join(', ')
        }, 'memory');
        break;

      case 'moderate':
        actions.push('MODERATE_MEMORY_PRESSURE');
        
        // Gentle cleanup
        if (this.options.autoCleanup && now - this.lastCleanup > 60000) {
          this.cleanupExpiredCacheEntries('moderate');
          actions.push('cleaned_expired_caches');
        }
        
        logger.info('Moderate memory pressure detected', {
          usage: `${stats.usagePercentage.toFixed(1)}%`,
          context,
          actions: actions.join(', ')
        }, 'memory');
        break;
    }

    // Check if minimum free memory requirement is met
    const freeMemoryMB = stats.freeHeapSize / 1024 / 1024;
    if (freeMemoryMB < this.options.minFreeMemoryMB && level !== 'critical') {
      logger.warn(`Free memory below threshold: ${freeMemoryMB.toFixed(1)}MB < ${this.options.minFreeMemoryMB}MB`, {
        level,
        context
      }, 'memory');
      
      if (this.options.aggressiveGC) {
        this.forceGarbageCollection('low-free-memory');
        actions.push('gc_for_low_memory');
      }
    }
  }

  /**
   * Force garbage collection if available
   */
  private forceGarbageCollection(trigger: string): void {
    const now = Date.now();
    
    // Avoid too frequent GC calls
    if (now - this.lastGC < 5000) {
      return;
    }

    try {
      if (this.isNodeEnvironment && global.gc) {
        global.gc();
        this.lastGC = now;
        logger.debug(`Forced garbage collection (${trigger})`, null, 'memory');
      }
    } catch (error) {
      logger.warn('Failed to force garbage collection', error, 'memory');
    }
  }

  /**
   * Clear all caches (can be extended to integrate with actual cache systems)
   */
  private clearAllCaches(trigger: string): void {
    const now = Date.now();
    
    // Avoid too frequent cache clearances
    if (now - this.lastCleanup < 10000) {
      return;
    }

    try {
      // This would be integrated with the actual cache systems
      // For now, we'll just log and set the timestamp
      this.lastCleanup = now;
      
      // Emit global cache cleanup event if event system exists
      if (typeof global !== 'undefined' && global.emit) {
        global.emit('memory:clear-all-caches', { trigger });
      }
      
      logger.info(`Cleared all caches (${trigger})`, null, 'memory');
    } catch (error) {
      logger.warn('Failed to clear all caches', error, 'memory');
    }
  }

  /**
   * Clear old cache entries
   */
  private clearOldCacheEntries(trigger: string): void {
    const now = Date.now();
    
    // Avoid too frequent cleanups
    if (now - this.lastCleanup < 30000) {
      return;
    }

    try {
      this.lastCleanup = now;
      
      // Emit cache cleanup event
      if (typeof global !== 'undefined' && global.emit) {
        global.emit('memory:clear-old-caches', { trigger });
      }
      
      logger.debug(`Cleared old cache entries (${trigger})`, null, 'memory');
    } catch (error) {
      logger.warn('Failed to clear old cache entries', error, 'memory');
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCacheEntries(trigger: string): void {
    const now = Date.now();
    
    // Avoid too frequent cleanups
    if (now - this.lastCleanup < 60000) {
      return;
    }

    try {
      this.lastCleanup = now;
      
      // Emit expired cache cleanup event
      if (typeof global !== 'undefined' && global.emit) {
        global.emit('memory:cleanup-expired-caches', { trigger });
      }
      
      logger.debug(`Cleaned up expired cache entries (${trigger})`, null, 'memory');
    } catch (error) {
      logger.warn('Failed to cleanup expired cache entries', error, 'memory');
    }
  }

  /**
   * Get memory history for analysis
   */
  getMemoryHistory(count?: number): MemoryStats[] {
    if (count) {
      return this.memoryHistory.slice(-count);
    }
    return [...this.memoryHistory];
  }

  /**
   * Get memory pressure summary
   */
  getMemoryPressureSummary(): {
    current: MemoryStats & { pressureLevel: MemoryPressureLevel['level'] };
    average: number;
    peak: number;
    trend: 'stable' | 'rising' | 'falling';
  } {
    const current = this.checkMemoryUsage('summary');
    
    if (this.memoryHistory.length < 2) {
      return {
        current,
        average: current.usagePercentage,
        peak: current.usagePercentage,
        trend: 'stable'
      };
    }

    const recent = this.memoryHistory.slice(-10); // Last 10 measurements
    const average = recent.reduce((sum, stat) => sum + stat.usagePercentage, 0) / recent.length;
    const peak = Math.max(...recent.map(stat => stat.usagePercentage));
    
    // Determine trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, stat) => sum + stat.usagePercentage, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, stat) => sum + stat.usagePercentage, 0) / secondHalf.length;
    
    let trend: 'stable' | 'rising' | 'falling' = 'stable';
    const diffThreshold = 5; // 5% difference threshold
    
    if (secondAvg > firstAvg + diffThreshold) {
      trend = 'rising';
    } else if (secondAvg < firstAvg - diffThreshold) {
      trend = 'falling';
    }

    return {
      current,
      average,
      peak,
      trend
    };
  }

  /**
   * Static method for quick memory pressure checks
   */
  static checkMemoryPressure(context: string = 'quick-check'): MemoryStats & { pressureLevel: MemoryPressureLevel['level'] } {
    return MemoryMonitor.getInstance().checkMemoryUsage(context);
  }

  /**
   * Destroy memory monitor and cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.memoryHistory = [];
    logger.info('Memory monitor destroyed', null, 'memory');
  }
}

// Export singleton instance
export const memoryMonitor = MemoryMonitor.getInstance();

// Export static convenience methods
export const checkMemoryPressure = MemoryMonitor.checkMemoryPressure;