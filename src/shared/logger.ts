/**
 * Logger Utility
 * Provides conditional logging based on environment
 * Replaces all console.log statements in production
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

export class Logger {
  private static level: LogLevel = this.getLogLevel();
  private static logs: LogEntry[] = [];
  private static maxLogs: number = 1000;

  /**
   * Determine log level based on environment
   */
  private static getLogLevel(): LogLevel {
    // Check various environment indicators
    const isProduction = 
      process?.env?.NODE_ENV === 'production' ||
      window?.location?.hostname !== 'localhost' ||
      window?.location?.hostname !== '127.0.0.1';
    
    if (isProduction) {
      return LogLevel.WARN; // Only show warnings and errors in production
    }
    
    return LogLevel.DEBUG; // Show all logs in development
  }

  /**
   * Add log entry to memory buffer
   */
  private static addLogEntry(level: LogLevel, message: string, data?: any, context?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    };

    this.logs.push(entry);
    
    // Keep only recent logs to prevent memory leaks
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Debug level logging
   */
  static debug(message: string, data?: any, context?: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, data || '');
      this.addLogEntry(LogLevel.DEBUG, message, data, context);
    }
  }

  /**
   * Info level logging
   */
  static info(message: string, data?: any, context?: string): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, data || '');
      this.addLogEntry(LogLevel.INFO, message, data, context);
    }
  }

  /**
   * Warning level logging
   */
  static warn(message: string, data?: any, context?: string): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, data || '');
      this.addLogEntry(LogLevel.WARN, message, data, context);
    }
  }

  /**
   * Error level logging
   */
  static error(message: string, error?: any, context?: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error || '');
      this.addLogEntry(LogLevel.ERROR, message, error, context);
    }
  }

  /**
   * Upload progress logging (specialized for upload operations)
   */
  static uploadProgress(fileName: string, progress: number, transferId?: string): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `Upload progress: ${fileName} - ${progress.toFixed(1)}%`;
      this.debug(message, { progress, transferId }, 'upload');
    }
  }

  /**
   * Download progress logging (specialized for download operations)
   */
  static downloadProgress(fileName: string, progress: number, downloadId?: string): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `Download progress: ${fileName} - ${progress.toFixed(1)}%`;
      this.debug(message, { progress, downloadId }, 'download');
    }
  }

  /**
   * Transfer progress logging (generic for any transfer operation)
   */
  static transferProgress(operation: string, progress: number, transferId?: string): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `${operation} progress: ${progress.toFixed(1)}%`;
      this.debug(message, { progress, transferId }, 'transfer');
    }
  }

  /**
   * Image operation logging
   */
  static image(operation: string, details: any): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `Image ${operation}`;
      this.debug(message, details, 'image');
    }
  }

  /**
   * Network quality logging
   */
  static network(quality: string, speed?: number, details?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `Network quality: ${quality}`;
      this.debug(message, { speed, ...details }, 'network');
    }
  }

  /**
   * Performance logging
   */
  static performance(operation: string, duration: number, details?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      const message = `Performance: ${operation} completed in ${duration}ms`;
      this.debug(message, details, 'performance');
    }
  }

  /**
   * Get current log level
   */
  static getLogLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set log level (for testing or dynamic adjustment)
   */
  static setLogLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get recent logs for debugging
   */
  static getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get logs by level
   */
  static getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs by context
   */
  static getLogsByContext(context: string): LogEntry[] {
    return this.logs.filter(log => log.context === context);
  }

  /**
   * Clear all logs
   */
  static clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs for analysis
   */
  static exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Get log statistics
   */
  static getStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byContext: Record<string, number>;
  } {
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0
    };

    const byContext: Record<string, number> = {};

    this.logs.forEach(log => {
      byLevel[log.level]++;
      if (log.context) {
        byContext[log.context] = (byContext[log.context] || 0) + 1;
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byContext
    };
  }
}

// Export for use in browser environment
if (typeof window !== 'undefined') {
  (window as any).Logger = Logger;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Logger, LogLevel };
}

// Export singleton instance
export const logger = Logger;
