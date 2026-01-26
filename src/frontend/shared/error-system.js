/**
 * Error System - JavaScript version
 * Provides error handling utilities for the application
 */

(function() {
    'use strict';

    // Error codes enum
    window.ErrorCode = {
        // Validation errors
        VALIDATION_FAILED: 'VALIDATION_FAILED',
        INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        INVALID_FILE_NAME: 'INVALID_FILE_NAME',
        INVALID_PATH: 'INVALID_PATH',
        INVALID_BUCKET_NAME: 'INVALID_BUCKET_NAME',
        INVALID_PARAMETERS: 'INVALID_PARAMETERS',
        
        // Upload/Download errors
        UPLOAD_FAILED: 'UPLOAD_FAILED',
        DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
        UPLOAD_CANCELLED: 'UPLOAD_CANCELLED',
        DOWNLOAD_CANCELLED: 'DOWNLOAD_CANCELLED',
        CHUNK_UPLOAD_FAILED: 'CHUNK_UPLOAD_FAILED',
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',
        
        // Network errors
        NETWORK_ERROR: 'NETWORK_ERROR',
        CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
        SERVER_ERROR: 'SERVER_ERROR',
        RATE_LIMITED: 'RATE_LIMITED',
        
        // System errors
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        MEMORY_ERROR: 'MEMORY_ERROR',
        STORAGE_ERROR: 'STORAGE_ERROR',
        PERMISSION_DENIED: 'PERMISSION_DENIED'
    };

    // Error categories
    window.ErrorCategory = {
        VALIDATION: 'validation',
        UPLOAD: 'upload',
        DOWNLOAD: 'download',
        NETWORK: 'network',
        SYSTEM: 'system',
        USER: 'user'
    };

    // Error severity levels
    window.ErrorSeverity = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // AppError class
    class AppError extends Error {
        constructor(code, message, statusCode = 500, category = window.ErrorCategory.SYSTEM, severity = window.ErrorSeverity.MEDIUM, context = {}) {
            super(message);
            this.code = code;
            this.message = message;
            this.statusCode = statusCode;
            this.category = category;
            this.severity = severity;
            this.context = context;
            this.timestamp = new Date().toISOString();
            this.name = 'AppError';
            
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
        }
    }

    // Error factory
    window.ErrorFactory = {
        createValidationError: function(message, details) {
            return new AppError(
                window.ErrorCode.VALIDATION_FAILED,
                message,
                400,
                window.ErrorCategory.VALIDATION,
                window.ErrorSeverity.MEDIUM,
                details
            );
        },
        
        createUploadError: function(message, details) {
            return new AppError(
                window.ErrorCode.UPLOAD_FAILED,
                message,
                500,
                window.ErrorCategory.UPLOAD,
                window.ErrorSeverity.HIGH,
                details
            );
        },
        
        createDownloadError: function(message, details) {
            return new AppError(
                window.ErrorCode.DOWNLOAD_FAILED,
                message,
                500,
                window.ErrorCategory.DOWNLOAD,
                window.ErrorSeverity.HIGH,
                details
            );
        },
        
        createNetworkError: function(message, details) {
            return new AppError(
                window.ErrorCode.NETWORK_ERROR,
                message,
                503,
                window.ErrorCategory.NETWORK,
                window.ErrorSeverity.HIGH,
                details
            );
        },
        
        createFileNotFound: function(message, details) {
            return new AppError(
                window.ErrorCode.FILE_NOT_FOUND,
                message,
                404,
                window.ErrorCategory.DOWNLOAD,
                window.ErrorSeverity.MEDIUM,
                details
            );
        },
        
        createPermissionDenied: function(message, details) {
            return new AppError(
                window.ErrorCode.PERMISSION_DENIED,
                message,
                403,
                window.ErrorCategory.SYSTEM,
                window.ErrorSeverity.HIGH,
                details
            );
        },
        
        createError: function(code, message, statusCode = 500, category = window.ErrorCategory.SYSTEM, details = {}) {
            return new AppError(code, message, statusCode, category, window.ErrorSeverity.MEDIUM, details);
        }
    };

    // Error handler
    window.ErrorHandler = {
        handleError: function(error, context = {}) {
            // Log the error
            if (window.Logger) {
                window.Logger.error(error.message || 'Unknown error', {
                    code: error.code || 'UNKNOWN',
                    stack: error.stack,
                    context,
                    category: error.category || 'unknown',
                    severity: error.severity || 'medium'
                }, 'error-handler');
            } else {
                console.error('Error:', error.message, { code: error.code, context });
            }

            // Format response for user
            const isDevelopment = window.SHARED_CONFIG?.ENVIRONMENT === 'development';
            
            if (isDevelopment) {
                return {
                    success: false,
                    error: {
                        code: error.code || 'UNKNOWN',
                        message: error.message || 'Unknown error occurred',
                        category: error.category || 'unknown',
                        severity: error.severity || 'medium',
                        context,
                        stack: error.stack
                    }
                };
            } else {
                return {
                    success: false,
                    error: {
                        message: this.getUserFriendlyMessage(error),
                        code: error.code
                    }
                };
            }
        },

        getUserFriendlyMessage: function(error) {
            const messageMap = {
                [window.ErrorCode.FILE_TOO_LARGE]: 'The file is too large to upload.',
                [window.ErrorCode.INVALID_FILE_TYPE]: 'This file type is not supported.',
                [window.ErrorCode.NETWORK_ERROR]: 'Network connection error. Please check your internet connection.',
                [window.ErrorCode.FILE_NOT_FOUND]: 'The requested file was not found.',
                [window.ErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.',
                [window.ErrorCode.UPLOAD_FAILED]: 'Failed to upload the file.',
                [window.ErrorCode.DOWNLOAD_FAILED]: 'Failed to download the file.',
                [window.ErrorCode.CONNECTION_TIMEOUT]: 'Request timed out. Please try again.',
                [window.ErrorCode.SERVER_ERROR]: 'Server error occurred. Please try again later.',
                [window.ErrorCode.VALIDATION_FAILED]: 'Invalid input provided.',
                [window.ErrorCode.INVALID_FILE_NAME]: 'Invalid file name.',
                [window.ErrorCode.INVALID_PATH]: 'Invalid path specified.',
                [window.ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait and try again.'
            };

            return messageMap[error.code] || 'An error occurred. Please try again.';
        },

        isRetryableError: function(error) {
            const retryableCodes = [
                window.ErrorCode.NETWORK_ERROR,
                window.ErrorCode.CONNECTION_TIMEOUT,
                window.ErrorCode.SERVER_ERROR,
                window.ErrorCode.RATE_LIMITED
            ];
            return retryableCodes.includes(error.code);
        },

        shouldRetry: function(error, retryCount = 0, maxRetries = 3) {
            return this.isRetryableError(error) && retryCount < maxRetries;
        },

        calculateRetryDelay: function(retryCount, baseDelay = 1000, maxDelay = 30000) {
            // Exponential backoff with jitter
            const exponentialDelay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
            const jitter = Math.random() * 0.3 * exponentialDelay;
            return Math.floor(exponentialDelay + jitter);
        }
    };

    // Make AppError available globally
    window.AppError = AppError;

    console.log('✅ ErrorSystem loaded');
})();