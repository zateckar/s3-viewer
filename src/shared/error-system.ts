/**
 * Structured Error System
 * Provides comprehensive error handling with enum-based codes, context metadata, and standardized responses
 */

/**
 * Error Codes Enumeration
 * Centralized error classification for consistent handling
 */
export enum ErrorCode {
  // Validation Errors (1000-1099)
  INVALID_PATH = 'INVALID_PATH',
  INVALID_FILENAME = 'INVALID_FILENAME',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_FILE_SIZE = 'INVALID_FILE_SIZE',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Authentication & Authorization Errors (1100-1199)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // File System Errors (1200-1299)
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  FOLDER_ALREADY_EXISTS = 'FOLDER_ALREADY_EXISTS',
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
  PATH_TRAVERSAL_DETECTED = 'PATH_TRAVERSAL_DETECTED',
  
  // Upload/Download Errors (1300-1399)
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  UPLOAD_INTERRUPTED = 'UPLOAD_INTERRUPTED',
  UPLOAD_TIMEOUT = 'UPLOAD_TIMEOUT',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DOWNLOAD_INTERRUPTED = 'DOWNLOAD_INTERRUPTED',
  DOWNLOAD_TIMEOUT = 'DOWNLOAD_TIMEOUT',
  CHUNK_FAILED = 'CHUNK_FAILED',
  INVALID_CHUNK_SIZE = 'INVALID_CHUNK_SIZE',
  STORAGE_FULL = 'STORAGE_FULL',
  
  // Network Errors (1400-1499)
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  
  // S3/AWS Errors (1500-1599)
  S3_ACCESS_DENIED = 'S3_ACCESS_DENIED',
  S3_BUCKET_NOT_FOUND = 'S3_BUCKET_NOT_FOUND',
  S3_INVALID_REGION = 'S3_INVALID_REGION',
  S3_CREDENTIALS_INVALID = 'S3_CREDENTIALS_INVALID',
  S3_QUOTA_EXCEEDED = 'S3_QUOTA_EXCEEDED',
  S3_SLOW_DOWN = 'S3_SLOW_DOWN',
  
  // System Errors (1600-1699)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  DISK_FULL = 'DISK_FULL',
  SERVICE_ERROR = 'SERVICE_ERROR',
  
  // Business Logic Errors (1700-1799)
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  
  // Generic Errors (9000-9999)
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR'
}

/**
 * Error Severity Levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Error Categories
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  SYSTEM = 'system',
  BUSINESS = 'business',
  USER_ERROR = 'user_error',
  INFRASTRUCTURE = 'infrastructure'
}

/**
 * Error Context Interface
 * Provides detailed metadata about error circumstances
 */
export interface ErrorContext {
  /** Timestamp when error occurred */
  timestamp: string;
  
  /** User identifier (if available) */
  userId?: string;
  
  /** Session identifier */
  sessionId?: string;
  
  /** Request identifier */
  requestId?: string;
  
  /** Endpoint or operation being performed */
  operation?: string;
  
  /** File or resource being processed */
  resourcePath?: string;
  
  /** Additional key-value data */
  metadata?: Record<string, any>;
  
  /** Stack trace (development only) */
  stackTrace?: string;
  
  /** User agent (if applicable) */
  userAgent?: string;
  
  /** IP address (if available) */
  clientIP?: string;
  
  /** Component or module where error occurred */
  component?: string;
  
  /** Function or method name */
  function?: string;
}

/**
 * Enhanced Error Class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: ErrorContext;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly details?: any;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context: Partial<ErrorContext> = {},
    retryable: boolean = false,
    userMessage?: string,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.category = category;
    this.context = this.buildContext(context);
    this.retryable = retryable;
    this.userMessage = userMessage || this.getDefaultUserMessage(code, message);
    this.details = details;

    // Ensure stack trace is preserved
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Build comprehensive error context
   */
  private buildContext(partial: Partial<ErrorContext>): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      stackTrace: this.stack,
      ...partial
    };
  }

  /**
   * Get user-friendly message based on error code
   */
  private getDefaultUserMessage(code: ErrorCode, technicalMessage: string): string {
    const userMessages: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_PATH]: 'The file path you specified is invalid or contains illegal characters.',
      [ErrorCode.INVALID_FILENAME]: 'The file name contains invalid characters.',
      [ErrorCode.INVALID_FILE_TYPE]: 'This file type is not supported.',
      [ErrorCode.INVALID_FILE_SIZE]: 'The file size exceeds the allowed limit.',
      [ErrorCode.INVALID_PARAMETERS]: 'Invalid parameters were provided.',
      [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required information is missing.',
      [ErrorCode.UNAUTHORIZED]: 'You need to sign in to access this resource.',
      [ErrorCode.FORBIDDEN]: 'You don\'t have permission to access this resource.',
      [ErrorCode.INVALID_CREDENTIALS]: 'Your login information is incorrect.',
      [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You don\'t have sufficient permissions for this action.',
      [ErrorCode.FILE_NOT_FOUND]: 'The requested file was not found.',
      [ErrorCode.FOLDER_NOT_FOUND]: 'The requested folder was not found.',
      [ErrorCode.FILE_ALREADY_EXISTS]: 'A file with this name already exists.',
      [ErrorCode.FOLDER_ALREADY_EXISTS]: 'A folder with this name already exists.',
      [ErrorCode.DIRECTORY_NOT_EMPTY]: 'Cannot delete folder: it contains files.',
      [ErrorCode.PATH_TRAVERSAL_DETECTED]: 'Invalid file path detected.',
      [ErrorCode.UPLOAD_FAILED]: 'Failed to upload the file.',
      [ErrorCode.UPLOAD_INTERRUPTED]: 'Upload was interrupted.',
      [ErrorCode.UPLOAD_TIMEOUT]: 'Upload timed out.',
      [ErrorCode.DOWNLOAD_FAILED]: 'Failed to download the file.',
      [ErrorCode.DOWNLOAD_INTERRUPTED]: 'Download was interrupted.',
      [ErrorCode.DOWNLOAD_TIMEOUT]: 'Download timed out.',
      [ErrorCode.CHUNK_FAILED]: 'Failed to process file chunk.',
      [ErrorCode.INVALID_CHUNK_SIZE]: 'Invalid chunk size for file transfer.',
      [ErrorCode.STORAGE_FULL]: 'Storage quota exceeded.',
      [ErrorCode.NETWORK_ERROR]: 'Network connection error occurred.',
      [ErrorCode.CONNECTION_LOST]: 'Connection to server was lost.',
      [ErrorCode.TIMEOUT_ERROR]: 'Operation timed out.',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
      [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
      [ErrorCode.DNS_RESOLUTION_FAILED]: 'Unable to connect to the server.',
      [ErrorCode.S3_ACCESS_DENIED]: 'Access to storage service denied.',
      [ErrorCode.S3_BUCKET_NOT_FOUND]: 'Storage bucket not found.',
      [ErrorCode.S3_INVALID_REGION]: 'Invalid storage region.',
      [ErrorCode.S3_CREDENTIALS_INVALID]: 'Storage credentials are invalid.',
      [ErrorCode.S3_QUOTA_EXCEEDED]: 'Storage quota exceeded.',
      [ErrorCode.S3_SLOW_DOWN]: 'Storage service is busy. Please try again.',
      [ErrorCode.INTERNAL_ERROR]: 'An internal error occurred. Please try again.',
      [ErrorCode.CONFIGURATION_ERROR]: 'Service is not properly configured.',
      [ErrorCode.DATABASE_ERROR]: 'Database error occurred.',
      [ErrorCode.MEMORY_ERROR]: 'Server is running low on memory.',
      [ErrorCode.DISK_FULL]: 'Server disk is full.',
      [ErrorCode.SERVICE_ERROR]: 'External service error.',
      [ErrorCode.OPERATION_NOT_ALLOWED]: 'This operation is not allowed.',
      [ErrorCode.RESOURCE_LOCKED]: 'Resource is currently being used by another operation.',
      [ErrorCode.CONCURRENT_MODIFICATION]: 'Resource was modified by another user.',
      [ErrorCode.QUOTA_EXCEEDED]: 'Your quota has been exceeded.',
      [ErrorCode.SUBSCRIPTION_EXPIRED]: 'Your subscription has expired.',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
      [ErrorCode.VALIDATION_ERROR]: 'Input validation failed.',
      [ErrorCode.PARSE_ERROR]: 'Failed to parse data.',
      [ErrorCode.SERIALIZATION_ERROR]: 'Failed to process data.'
    };

    return userMessages[code] || technicalMessage;
  }

  /**
   * Convert to JSON format
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      context: this.context,
      retryable: this.retryable,
      details: this.details
    };
  }

  /**
   * Convert to user-friendly format
   */
  toUserFormat() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.userMessage,
        retryable: this.retryable
      }
    };
  }

  /**
   * Convert to development format (with full details)
   */
  toDevFormat() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        severity: this.severity,
        category: this.category,
        context: this.context,
        retryable: this.retryable,
        details: this.details
      }
    };
  }
}

/**
 * Error Factory
 * Provides convenient methods to create common errors
 */
export class ErrorFactory {
  /**
   * Create validation error
   */
  static validation(message: string, field?: string, value?: any): AppError {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      message,
      400,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION,
      { metadata: { field, value } },
      false
    );
  }

  /**
   * Create not found error
   */
  static notFound(resource: string, identifier?: string): AppError {
    return new AppError(
      ErrorCode.FILE_NOT_FOUND,
      `${resource}${identifier ? ` '${identifier}'` : ''} not found`,
      404,
      ErrorSeverity.LOW,
      ErrorCategory.FILESYSTEM,
      { resourcePath: identifier, metadata: { resource } },
      false
    );
  }

  /**
   * Create unauthorized error
   */
  static unauthorized(message?: string): AppError {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      message || 'Authentication required',
      401,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHENTICATION,
      {},
      false
    );
  }

  /**
   * Create forbidden error
   */
  static forbidden(action?: string): AppError {
    return new AppError(
      ErrorCode.FORBIDDEN,
      action ? `Not authorized to ${action}` : 'Access denied',
      403,
      ErrorSeverity.MEDIUM,
      ErrorCategory.AUTHORIZATION,
      { metadata: { action } },
      false
    );
  }

  /**
   * Create network error
   */
  static network(message?: string, retryable: boolean = true): AppError {
    return new AppError(
      ErrorCode.NETWORK_ERROR,
      message || 'Network connection error',
      503,
      ErrorSeverity.HIGH,
      ErrorCategory.NETWORK,
      {},
      retryable
    );
  }

  /**
   * Create timeout error
   */
  static timeout(operation: string, duration?: number): AppError {
    return new AppError(
      ErrorCode.TIMEOUT_ERROR,
      `${operation} timed out${duration ? ` after ${duration}ms` : ''}`,
      408,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK,
      { metadata: { operation, duration } },
      true
    );
  }

  /**
   * Create upload error
   */
  static uploadFailed(fileName: string, reason?: string): AppError {
    return new AppError(
      ErrorCode.UPLOAD_FAILED,
      `Failed to upload '${fileName}'${reason ? `: ${reason}` : ''}`,
      500,
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILESYSTEM,
      { resourcePath: fileName, metadata: { reason } },
      true
    );
  }

  /**
   * Create download error
   */
  static downloadFailed(fileName: string, reason?: string): AppError {
    return new AppError(
      ErrorCode.DOWNLOAD_FAILED,
      `Failed to download '${fileName}'${reason ? `: ${reason}` : ''}`,
      500,
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILESYSTEM,
      { resourcePath: fileName, metadata: { reason } },
      true
    );
  }

  /**
   * Create internal server error
   */
  static internal(message?: string, details?: any): AppError {
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      message || 'Internal server error',
      500,
      ErrorSeverity.CRITICAL,
      ErrorCategory.SYSTEM,
      { metadata: details },
      false
    );
  }

  /**
   * Create rate limit error
   */
  static rateLimit(resetTime?: number): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded. Please try again later.',
      429,
      ErrorSeverity.MEDIUM,
      ErrorCategory.USER_ERROR,
      { metadata: { resetTime } },
      true
    );
  }
}

/**
 * Error Handler Utility
 * Provides centralized error processing and logging
 */
export class ErrorHandler {
  /**
   * Process and log error
   */
  static process(error: Error | AppError, context: Partial<ErrorContext> = {}): AppError {
    let appError: AppError;

    if (error instanceof AppError) {
      // Enhance existing error with additional context
      appError = error;
      appError.context = { ...appError.context, ...context, timestamp: new Date().toISOString() };
    } else {
      // Convert regular error to AppError
      appError = new AppError(
        ErrorCode.INTERNAL_ERROR,
        error.message || 'Unknown error occurred',
        500,
        ErrorSeverity.HIGH,
        ErrorCategory.SYSTEM,
        { ...context, originalError: error.name, stackTrace: error.stack }
      );
    }

    // Log based on severity
    if (window.Logger) {
      switch (appError.severity) {
        case ErrorSeverity.CRITICAL:
        case ErrorSeverity.HIGH:
          window.Logger.error('Error occurred', appError.toJSON(), appError.context.component || 'error-handler');
          break;
        case ErrorSeverity.MEDIUM:
          window.Logger.warn('Error occurred', appError.toJSON(), appError.context.component || 'error-handler');
          break;
        default:
          window.Logger.info('Error occurred', appError.toJSON(), appError.context.component || 'error-handler');
          break;
      }
    } else {
      console.error('Error:', appError.toJSON());
    }

    return appError;
  }

  /**
   * Create API response from error
   */
  static createResponse(error: Error | AppError, isDevelopment: boolean = false): Response {
    const appError = this.process(error);
    const responseFormat = isDevelopment ? appError.toDevFormat() : appError.toUserFormat();
    
    return Response.json(responseFormat, {
      status: appError.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Code': appError.code,
        'X-Error-Retryable': appError.retryable.toString()
      }
    });
  }

  /**
   * Determine if error is retryable
   */
  static isRetryable(error: Error | AppError): boolean {
    if (error instanceof AppError) {
      return error.retryable;
    }
    
    // Common retryable error patterns
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /rate.*limit/i,
      /slow.*down/i
    ];
    
    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Get retry delay for retryable errors
   */
  static getRetryDelay(error: Error | AppError, attempt: number = 1): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    
    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    
    return delay + jitter;
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).ErrorCode = ErrorCode;
  (window as any).AppError = AppError;
  (window as any).ErrorFactory = ErrorFactory;
  (window as any).ErrorHandler = ErrorHandler;
}

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ErrorCode, 
    ErrorSeverity, 
    ErrorCategory, 
    AppError, 
    ErrorFactory, 
    ErrorHandler 
  };
}