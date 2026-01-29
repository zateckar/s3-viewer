import { getConfig } from '../config/context';

/**
 * Error Codes Enumeration - Backend specific
 */
export enum ErrorCode {
  // Validation Errors
  INVALID_PATH = 'INVALID_PATH',
  INVALID_BUCKET = 'INVALID_BUCKET',
  INVALID_FILENAME = 'INVALID_FILENAME',
  INVALID_FILE_SIZE = 'INVALID_FILE_SIZE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE',
  INVALID_RANGE = 'INVALID_RANGE',
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_FORM_DATA = 'INVALID_FORM_DATA',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  INVALID_OPERATION = 'INVALID_OPERATION',
  INVALID_IMAGE_TYPE = 'INVALID_IMAGE_TYPE',
  
  // Missing Data Errors
  MISSING_PATH = 'MISSING_PATH',
  MISSING_FILE = 'MISSING_FILE',
  MISSING_BUCKET_NAME = 'MISSING_BUCKET_NAME',
  
  // Resource Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',
  BUCKET_NOT_FOUND = 'BUCKET_NOT_FOUND',
  BUCKET_INACCESSIBLE = 'BUCKET_INACCESSIBLE',
  
  // Access Errors
  ACCESS_DENIED = 'ACCESS_DENIED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Operation Errors
  LIST_ERROR = 'LIST_ERROR',
  DOWNLOAD_ERROR = 'DOWNLOAD_ERROR',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DELETE_ERROR = 'DELETE_ERROR',
  CREATE_FOLDER_ERROR = 'CREATE_FOLDER_ERROR',
  STREAM_ERROR = 'STREAM_ERROR',
  PREVIEW_ERROR = 'PREVIEW_ERROR',
  INFO_ERROR = 'INFO_ERROR',
  POST_ERROR = 'POST_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  
  // Bucket Errors
  BUCKETS_ERROR = 'BUCKETS_ERROR',
  BUCKET_VALIDATION_ERROR = 'BUCKET_VALIDATION_ERROR',
  BUCKET_SWITCH_ERROR = 'BUCKET_SWITCH_ERROR',
  
  // General Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * HTTP Status Code mapping for error codes
 */
const ERROR_STATUS_CODES: Record<string, number> = {
  // 400 Bad Request
  [ErrorCode.INVALID_PATH]: 400,
  [ErrorCode.INVALID_BUCKET]: 400,
  [ErrorCode.INVALID_FILENAME]: 400,
  [ErrorCode.INVALID_FILE_SIZE]: 400,
  [ErrorCode.INVALID_FILE_TYPE]: 400,
  [ErrorCode.INVALID_CONTENT_TYPE]: 400,
  [ErrorCode.INVALID_RANGE]: 400,
  [ErrorCode.INVALID_ACTION]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.INVALID_FORM_DATA]: 400,
  [ErrorCode.INVALID_PARAMETERS]: 400,
  [ErrorCode.INVALID_OPERATION]: 400,
  [ErrorCode.INVALID_IMAGE_TYPE]: 400,
  [ErrorCode.MISSING_PATH]: 400,
  [ErrorCode.MISSING_FILE]: 400,
  [ErrorCode.MISSING_BUCKET_NAME]: 400,
  
  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  
  // 403 Forbidden
  [ErrorCode.ACCESS_DENIED]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.BUCKET_INACCESSIBLE]: 403,
  
  // 404 Not Found
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.FOLDER_NOT_FOUND]: 404,
  [ErrorCode.BUCKET_NOT_FOUND]: 404,
  
  // 405 Method Not Allowed
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  
  // 408 Request Timeout
  [ErrorCode.TIMEOUT_ERROR]: 408,
  
  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  // 500 Internal Server Error
  [ErrorCode.LIST_ERROR]: 500,
  [ErrorCode.DOWNLOAD_ERROR]: 500,
  [ErrorCode.UPLOAD_FAILED]: 500,
  [ErrorCode.DELETE_ERROR]: 500,
  [ErrorCode.CREATE_FOLDER_ERROR]: 500,
  [ErrorCode.STREAM_ERROR]: 500,
  [ErrorCode.PREVIEW_ERROR]: 500,
  [ErrorCode.INFO_ERROR]: 500,
  [ErrorCode.POST_ERROR]: 500,
  [ErrorCode.PROCESSING_ERROR]: 500,
  [ErrorCode.BUCKETS_ERROR]: 500,
  [ErrorCode.BUCKET_VALIDATION_ERROR]: 500,
  [ErrorCode.BUCKET_SWITCH_ERROR]: 500,
  [ErrorCode.INTERNAL_ERROR]: 500,
  
  // 503 Service Unavailable
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.INVALID_PATH]: 'The file path you specified is invalid or contains illegal characters.',
  [ErrorCode.INVALID_BUCKET]: 'The bucket name is invalid.',
  [ErrorCode.INVALID_FILENAME]: 'The file name contains invalid characters.',
  [ErrorCode.INVALID_FILE_SIZE]: 'The file size exceeds the allowed limit.',
  [ErrorCode.INVALID_FILE_TYPE]: 'This file type is not supported.',
  [ErrorCode.INVALID_CONTENT_TYPE]: 'Invalid content type provided.',
  [ErrorCode.INVALID_RANGE]: 'Invalid byte range specified.',
  [ErrorCode.INVALID_ACTION]: 'The requested action is not valid.',
  [ErrorCode.INVALID_JSON]: 'Invalid JSON data provided.',
  [ErrorCode.INVALID_FORM_DATA]: 'Invalid form data provided.',
  [ErrorCode.INVALID_PARAMETERS]: 'Invalid parameters provided.',
  [ErrorCode.INVALID_OPERATION]: 'This operation is not allowed.',
  [ErrorCode.INVALID_IMAGE_TYPE]: 'File is not a supported image type.',
  [ErrorCode.MISSING_PATH]: 'Path parameter is required.',
  [ErrorCode.MISSING_FILE]: 'No file was provided for upload.',
  [ErrorCode.MISSING_BUCKET_NAME]: 'Bucket name is required.',
  [ErrorCode.FILE_NOT_FOUND]: 'The requested file was not found.',
  [ErrorCode.FOLDER_NOT_FOUND]: 'The requested folder was not found.',
  [ErrorCode.BUCKET_NOT_FOUND]: 'The requested bucket was not found.',
  [ErrorCode.BUCKET_INACCESSIBLE]: 'The bucket is not accessible.',
  [ErrorCode.ACCESS_DENIED]: 'Access denied to the requested resource.',
  [ErrorCode.UNAUTHORIZED]: 'Authentication is required.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to access this resource.',
  [ErrorCode.LIST_ERROR]: 'Failed to list files.',
  [ErrorCode.DOWNLOAD_ERROR]: 'Failed to download file.',
  [ErrorCode.UPLOAD_FAILED]: 'Failed to upload file.',
  [ErrorCode.DELETE_ERROR]: 'Failed to delete item.',
  [ErrorCode.CREATE_FOLDER_ERROR]: 'Failed to create folder.',
  [ErrorCode.STREAM_ERROR]: 'Failed to create download stream.',
  [ErrorCode.PREVIEW_ERROR]: 'Failed to generate preview.',
  [ErrorCode.INFO_ERROR]: 'Failed to get file information.',
  [ErrorCode.POST_ERROR]: 'Failed to process request.',
  [ErrorCode.PROCESSING_ERROR]: 'Error processing request.',
  [ErrorCode.BUCKETS_ERROR]: 'Failed to retrieve buckets.',
  [ErrorCode.BUCKET_VALIDATION_ERROR]: 'Failed to validate buckets.',
  [ErrorCode.BUCKET_SWITCH_ERROR]: 'Failed to switch bucket.',
  [ErrorCode.INTERNAL_ERROR]: 'An internal server error occurred.',
  [ErrorCode.METHOD_NOT_ALLOWED]: 'HTTP method not allowed.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
  [ErrorCode.TIMEOUT_ERROR]: 'Request timed out.',
};

/**
 * Retryable error codes
 */
const RETRYABLE_ERRORS = new Set([
  ErrorCode.TIMEOUT_ERROR,
  ErrorCode.RATE_LIMIT_EXCEEDED,
  ErrorCode.SERVICE_UNAVAILABLE,
  ErrorCode.STREAM_ERROR,
  ErrorCode.LIST_ERROR,
  ErrorCode.DOWNLOAD_ERROR,
  ErrorCode.UPLOAD_FAILED,
]);

export interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

export interface AppErrorResponse {
  code: ErrorCode;
  message: string;
  details?: any;
  statusCode: number;
  retryable: boolean;
}

/**
 * Custom Application Error Class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly retryable: boolean;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: any,
    statusCode?: number
  ) {
    super(message || ERROR_MESSAGES[code] || 'An error occurred');
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode || ERROR_STATUS_CODES[code] || 500;
    this.details = details;
    this.retryable = RETRYABLE_ERRORS.has(code);
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toResponse(): AppErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

/**
 * Creates a success response with consistent format
 */
export function createSuccessResponse(data: any, message: string = 'Operation completed successfully'): Response {
  const response: ApiResponse = {
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return Response.json(response, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Response-Time': Date.now().toString(),
    }
  });
}

/**
 * Creates an error response with consistent format
 */
export function createErrorResponse(
  code: string | ErrorCode, 
  message: string, 
  details?: any, 
  status?: number
): Response {
  const errorCode = code as ErrorCode;
  const statusCode = status || ERROR_STATUS_CODES[errorCode] || 400;
  const retryable = RETRYABLE_ERRORS.has(errorCode);
  const config = getConfig();

  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message || ERROR_MESSAGES[errorCode] || 'An error occurred',
      details: config.nodeEnv === 'development' ? details : undefined,
      retryable,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  return Response.json(response, { 
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': errorCode,
      'X-Error-Retryable': retryable.toString(),
    }
  });
}

/**
 * Creates an error response from an AppError instance
 */
export function createAppErrorResponse(error: AppError): Response {
  const config = getConfig();
  const response: ApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details: config.nodeEnv === 'development' ? error.details : undefined,
      retryable: error.retryable,
    },
    meta: {
      timestamp: error.timestamp,
    },
  };

  return Response.json(response, {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Error-Code': error.code,
      'X-Error-Retryable': error.retryable.toString(),
    }
  });
}

/**
 * Error message mapping for common S3/file errors
 */
const S3_ERROR_MAPPING: Record<string, { code: ErrorCode; message: string }> = {
  'Invalid path': { code: ErrorCode.INVALID_PATH, message: 'Invalid file path provided' },
  'Failed to list files': { code: ErrorCode.LIST_ERROR, message: 'Failed to retrieve file list' },
  'Failed to generate download URL': { code: ErrorCode.DOWNLOAD_ERROR, message: 'Failed to generate download URL' },
  'Failed to create folder': { code: ErrorCode.CREATE_FOLDER_ERROR, message: 'Failed to create folder' },
  'Failed to delete item': { code: ErrorCode.DELETE_ERROR, message: 'Failed to delete file or folder' },
  'Failed to upload file': { code: ErrorCode.UPLOAD_FAILED, message: 'Failed to upload file' },
  'Failed to create download stream': { code: ErrorCode.STREAM_ERROR, message: 'Failed to create download stream' },
  'Failed to get file metadata': { code: ErrorCode.INFO_ERROR, message: 'Failed to get file information' },
};

/**
 * Handles errors and returns appropriate error responses
 */
export function handleError(error: any): Response {
  const config = getConfig();
  // Log error for debugging
  console.error('Error occurred:', {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    stack: config.nodeEnv === 'development' ? error?.stack : undefined,
  });

  // Handle AppError instances
  if (error instanceof AppError) {
    return createAppErrorResponse(error);
  }

  // Check if error message matches known S3 errors
  if (error?.message) {
    // Check for NotFound/NoSuchKey errors
    if (error.message.includes('NotFound') || 
        error.message.includes('NoSuchKey') || 
        error.message.includes('not found') ||
        error.message.includes('File not found')) {
      return createErrorResponse(
        ErrorCode.FILE_NOT_FOUND, 
        'The requested file or folder was not found',
        null,
        404
      );
    }

    // Check for access denied errors
    if (error.message.includes('AccessDenied') || 
        error.message.includes('Access denied')) {
      return createErrorResponse(
        ErrorCode.ACCESS_DENIED, 
        'Access denied to the requested resource',
        null,
        403
      );
    }

    // Check for mapped S3 errors
    for (const [pattern, mapping] of Object.entries(S3_ERROR_MAPPING)) {
      if (error.message.includes(pattern)) {
        return createErrorResponse(
          mapping.code, 
          mapping.message,
          null,
          ERROR_STATUS_CODES[mapping.code]
        );
      }
    }
  }

  // Handle specific error names
  if (error?.name) {
    switch (error.name) {
      case 'NoSuchKey':
        return createErrorResponse(
          ErrorCode.FILE_NOT_FOUND, 
          'The requested file or folder was not found',
          null,
          404
        );
      
      case 'AccessDenied':
        return createErrorResponse(
          ErrorCode.ACCESS_DENIED, 
          'Access denied to the requested resource',
          null,
          403
        );
      
      case 'InvalidBucketName':
        return createErrorResponse(
          ErrorCode.INVALID_BUCKET, 
          'Invalid bucket name',
          null,
          400
        );
      
      case 'NoSuchBucket':
        return createErrorResponse(
          ErrorCode.BUCKET_NOT_FOUND, 
          'The specified bucket does not exist',
          null,
          404
        );
      
      case 'SyntaxError':
        return createErrorResponse(
          ErrorCode.INVALID_JSON, 
          'Invalid JSON in request',
          null,
          400
        );
    }
  }

  // Default error response
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR, 
    config.nodeEnv === 'development' && error?.message 
      ? `Internal error: ${error.message}` 
      : 'An internal server error occurred',
    config.nodeEnv === 'development' ? { originalError: error?.message } : null,
    500
  );
}

/**
 * Error Factory for creating common errors
 */
export const ErrorFactory = {
  validation: (message: string, details?: any) => 
    new AppError(ErrorCode.INVALID_PARAMETERS, message, details, 400),
  
  notFound: (resource: string) => 
    new AppError(ErrorCode.FILE_NOT_FOUND, `${resource} not found`, null, 404),
  
  unauthorized: () => 
    new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required', null, 401),
  
  forbidden: (action?: string) => 
    new AppError(ErrorCode.FORBIDDEN, action ? `Not authorized to ${action}` : 'Access denied', null, 403),
  
  internal: (message?: string) => 
    new AppError(ErrorCode.INTERNAL_ERROR, message || 'Internal server error', null, 500),
  
  rateLimit: () => 
    new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', null, 429),
  
  timeout: (operation: string) => 
    new AppError(ErrorCode.TIMEOUT_ERROR, `${operation} timed out`, null, 408),
  
  uploadFailed: (reason?: string) => 
    new AppError(ErrorCode.UPLOAD_FAILED, reason || 'Upload failed', null, 500),
  
  downloadFailed: (reason?: string) => 
    new AppError(ErrorCode.DOWNLOAD_ERROR, reason || 'Download failed', null, 500),
};

/**
 * Determines if an error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  
  // Check error message for retryable patterns
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /connection/i,
    /rate.*limit/i,
    /slow.*down/i,
    /temporarily/i,
    /retry/i,
  ];
  
  const message = error?.message || '';
  return retryablePatterns.some(pattern => pattern.test(message));
}

/**
 * Calculate retry delay with exponential backoff
 */
export function getRetryDelay(attempt: number = 1, baseDelay: number = 1000): number {
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}
