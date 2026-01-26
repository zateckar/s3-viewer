/**
 * Formatting Utilities
 * Consolidates all formatting functions to eliminate code duplication
 * Provides consistent formatting across the application
 */

export class FormattingUtils {
  /**
   * File size constants for calculations
   */
  private static readonly BYTES_PER_KB = 1024;
  private static readonly BYTES_PER_MB = 1024 * 1024;
  private static readonly BYTES_PER_GB = 1024 * 1024 * 1024;
  private static readonly BYTES_PER_TB = 1024 * 1024 * 1024 * 1024;

  /**
   * Standard size categories for file display
   */
  private static readonly SIZE_CATEGORIES = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;

  /**
   * Format file size to human readable string
   * @param bytes - Size in bytes
   * @param precision - Decimal precision (default: 2)
   * @returns Formatted size string
   */
  static formatFileSize(bytes: number, precision: number = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = this.BYTES_PER_KB;
    const sizes = this.SIZE_CATEGORIES;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i];
  }

  /**
   * Format time duration to human readable string
   * @param seconds - Duration in seconds
   * @param detailed - Whether to show detailed format (default: false)
   * @returns Formatted time string
   */
  static formatTime(seconds: number, detailed: boolean = false): string {
    if (!seconds || seconds < 0) return '—';
    
    if (detailed) {
      // Detailed format: 1h 23m 45s
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    } else {
      // Compact format
      if (seconds < 60) {
        return Math.round(seconds) + 's';
      } else if (seconds < 3600) {
        return Math.round(seconds / 60) + 'm';
      } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
      }
    }
  }

  /**
   * Format transfer speed to human readable string
   * @param bytesPerSecond - Speed in bytes per second
   * @param precision - Decimal precision (default: 2)
   * @returns Formatted speed string
   */
  static formatSpeed(bytesPerSecond: number, precision: number = 2): string {
    if (!bytesPerSecond) return '—';
    return this.formatFileSize(bytesPerSecond, precision) + '/s';
  }

  /**
   * Format percentage with specified precision
   * @param value - Value between 0 and 1
   * @param precision - Decimal precision (default: 1)
   * @returns Formatted percentage string
   */
  static formatPercentage(value: number, precision: number = 1): string {
    if (typeof value !== 'number' || isNaN(value)) return '—';
    return `${value.toFixed(precision)}%`;
  }

  /**
   * Format number with thousand separators
   * @param num - Number to format
   * @returns Formatted number string
   */
  static formatNumber(num: number): string {
    if (typeof num !== 'number' || isNaN(num)) return '—';
    return num.toLocaleString();
  }

  /**
   * Format date to locale string
   * @param date - Date object or timestamp
   * @param includeTime - Whether to include time (default: true)
   * @returns Formatted date string
   */
  static formatDate(date: Date | string | number, includeTime: boolean = true): string {
    if (!date) return 'Unknown';
    
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    if (includeTime) {
      return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return dateObj.toLocaleDateString();
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago", "in 5 minutes")
   * @param date - Date to compare
   * @param referenceDate - Reference date (default: now)
   * @returns Relative time string
   */
  static formatRelativeTime(date: Date | string | number, referenceDate: Date = new Date()): string {
    if (!date) return 'Unknown';
    
    let dateObj: Date;
    if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
    
    const diffMs = referenceDate.getTime() - dateObj.getTime();
    const diffSeconds = Math.abs(Math.floor(diffMs / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    const isFuture = diffMs < 0;
    const suffix = isFuture ? 'from now' : 'ago';
    
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ${suffix}`;
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ${suffix}`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ${suffix}`;
    } else if (diffDays < 30) {
      return `${diffDays} days ${suffix}`;
    } else {
      // For dates more than a month apart, use standard date format
      return this.formatDate(dateObj);
    }
  }

  /**
   * Format file type extension
   * @param fileName - File name
   * @param uppercase - Whether to return uppercase (default: false)
   * @returns File extension string
   */
  static getFileExtension(fileName: string, uppercase: boolean = false): string {
    if (!fileName) return 'Unknown';
    
    const extension = fileName.split('.').pop();
    if (!extension) return 'Unknown';
    
    return uppercase ? extension.toUpperCase() : extension.toLowerCase();
  }

  /**
   * Format file type display name
   * @param fileName - File name
   * @returns Formatted file type string
   */
  static formatFileType(fileName: string): string {
    const extension = this.getFileExtension(fileName);
    if (extension === 'Unknown') return 'Unknown';
    
    // Common file type mappings
    const fileTypeMap: Record<string, string> = {
      'jpg': 'JPEG Image',
      'jpeg': 'JPEG Image',
      'png': 'PNG Image',
      'gif': 'GIF Image',
      'svg': 'SVG Image',
      'webp': 'WebP Image',
      'bmp': 'Bitmap Image',
      'ico': 'Icon',
      'pdf': 'PDF Document',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'xls': 'Excel Spreadsheet',
      'xlsx': 'Excel Spreadsheet',
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',
      'txt': 'Text File',
      'csv': 'CSV File',
      'json': 'JSON File',
      'xml': 'XML File',
      'zip': 'ZIP Archive',
      'rar': 'RAR Archive',
      '7z': '7-Zip Archive',
      'tar': 'TAR Archive',
      'gz': 'GZIP Archive',
      'mp4': 'MP4 Video',
      'avi': 'AVI Video',
      'mov': 'QuickTime Video',
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'flac': 'FLAC Audio'
    };
    
    return fileTypeMap[extension] || extension.toUpperCase() + ' File';
  }

  /**
   * Format transfer progress with multiple metrics
   * @param bytesTransferred - Bytes transferred
   * @param totalBytes - Total bytes
   * @param speed - Current speed in bytes per second
   * @param timeRemaining - Time remaining in seconds
   * @returns Formatted progress string
   */
  static formatTransferProgress(
    bytesTransferred: number,
    totalBytes: number,
    speed?: number,
    timeRemaining?: number
  ): string {
    const progress = totalBytes > 0 ? (bytesTransferred / totalBytes) * 100 : 0;
    const parts = [`${this.formatPercentage(progress)} complete`];
    
    if (bytesTransferred > 0 && totalBytes > 0) {
      parts.push(`${this.formatFileSize(bytesTransferred)} / ${this.formatFileSize(totalBytes)}`);
    }
    
    if (speed) {
      parts.push(`at ${this.formatSpeed(speed)}`);
    }
    
    if (timeRemaining !== undefined && timeRemaining > 0) {
      parts.push(`${this.formatTime(timeRemaining)} remaining`);
    }
    
    return parts.join(', ');
  }

  /**
   * Format memory usage in bytes
   * @param bytes - Memory usage in bytes
   * @param precision - Decimal precision (default: 2)
   * @returns Formatted memory string
   */
  static formatMemory(bytes: number, precision: number = 2): string {
    return this.formatFileSize(bytes, precision);
  }

  /**
   * Format network quality with color indicators
   * @param quality - Network quality string
   * @param speed - Current speed in bytes per second
   * @returns Formatted network quality string
   */
  static formatNetworkQuality(quality: string, speed?: number): string {
    const qualityMap: Record<string, string> = {
      'EXCELLENT': '🟢 Excellent',
      'GOOD': '🟡 Good',
      'FAIR': '🟠 Fair',
      'POOR': '🔴 Poor',
      'UNKNOWN': '⚪ Unknown'
    };
    
    const qualityDisplay = qualityMap[quality] || qualityMap['UNKNOWN'];
    
    if (speed) {
      return `${qualityDisplay} (${this.formatSpeed(speed)})`;
    }
    
    return qualityDisplay;
  }

  /**
   * Format error message with context
   * @param error - Error object or string
   * @param context - Additional context
   * @returns Formatted error message
   */
  static formatErrorMessage(error: Error | string, context?: string): string {
    let message: string;
    
    if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }
    
    if (context) {
      return `${context}: ${message}`;
    }
    
    return message;
  }

  /**
   * Truncate text to specified length
   * @param text - Text to truncate
   * @param maxLength - Maximum length
   * @param suffix - Suffix to append (default: "...")
   * @returns Truncated text
   */
  static truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (!text || text.length <= maxLength) {
      return text || '';
    }
    
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Format duration with milliseconds precision
   * @param milliseconds - Duration in milliseconds
   * @param showMilliseconds - Whether to show milliseconds (default: false)
   * @returns Formatted duration string
   */
  static formatDuration(milliseconds: number, showMilliseconds: boolean = false): string {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
      return '—';
    }
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const ms = milliseconds % 1000;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    let result = '';
    
    if (hours > 0) {
      result += `${hours}h `;
    }
    
    if (minutes > 0 || hours > 0) {
      result += `${minutes}m `;
    }
    
    result += `${seconds}s`;
    
    if (showMilliseconds) {
      result += ` ${ms}ms`;
    }
    
    return result.trim();
  }

  /**
   * Format amount with currency
   * @param amount - Amount to format
   * @param currency - Currency code (default: 'USD')
   * @param locale - Locale for formatting (default: 'en-US')
   * @returns Formatted currency string
   */
  static formatCurrency(amount: number, currency: string = 'USD', locale: string = 'en-US'): string {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '—';
    }
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).FormattingUtils = FormattingUtils;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormattingUtils };
}