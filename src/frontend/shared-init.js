/**
 * Shared Utilities Initialization
 * Loads all shared utilities and makes them available globally
 * This script should be loaded before the main application
 */

(function() {
    'use strict';

    // Global configuration
    window.SHARED_CONFIG = {
        ENVIRONMENT: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'development' : 'production',
        DEBUG: window.location.search.includes('debug=true'),
        VERSION: '1.0.0'
    };

    // Utilities registry
    window.SharedUtils = {
        loaded: [],
        loading: [],
        failed: []
    };

    /**
     * Load utility script dynamically
     */
    function loadUtilityScript(src, name) {
        return new Promise((resolve, reject) => {
            // Skip if already loaded
            if (window.SharedUtils.loaded.includes(name)) {
                resolve();
                return;
            }

            // Skip if currently loading
            if (window.SharedUtils.loading.includes(name)) {
                const checkLoaded = setInterval(() => {
                    if (window.SharedUtils.loaded.includes(name)) {
                        clearInterval(checkLoaded);
                        resolve();
                    } else if (window.SharedUtils.failed.includes(name)) {
                        clearInterval(checkLoaded);
                        reject(new Error(`Failed to load ${name}`));
                    }
                }, 50);
                return;
            }

            window.SharedUtils.loading.push(name);

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            
            script.onload = () => {
                window.SharedUtils.loaded.push(name);
                const index = window.SharedUtils.loading.indexOf(name);
                if (index > -1) {
                    window.SharedUtils.loading.splice(index, 1);
                }
                resolve();
            };

            script.onerror = () => {
                window.SharedUtils.failed.push(name);
                const index = window.SharedUtils.loading.indexOf(name);
                if (index > -1) {
                    window.SharedUtils.loading.splice(index, 1);
                }
                reject(new Error(`Failed to load ${name} from ${src}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Initialize shared utilities
     */
    async function initializeSharedUtilities() {
        try {
            // Determine base path
            const basePath = document.currentScript ?
                document.currentScript.src.replace(/\/[^\/]+$/, '') :
                '/shared';

            // Load utilities in dependency order
            const utilities = [
                { src: `${basePath}/logger.js`, name: 'Logger', global: 'Logger' },
                { src: `${basePath}/constants.js`, name: 'Constants', globals: ['FILE_CONSTANTS', 'TIMEOUT_CONSTANTS', 'NETWORK_CONSTANTS', 'UI_CONSTANTS', 'FILE_TYPE_CONSTANTS', 'STORAGE_CONSTANTS', 'ERROR_CONSTANTS', 'PRIORITY_CONSTANTS', 'API_CONSTANTS', 'INPUT_CONSTANTS', 'MATH_CONSTANTS', 'SECURITY_CONSTANTS', 'DEBUG_CONSTANTS'] },
                { src: `${basePath}/timer-manager.js`, name: 'TimerManager', globals: ['TimerManager', 'BrowserTimerManager', 'ComponentWithTimers'] },
                { src: `${basePath}/formatting-utils.js`, name: 'FormattingUtils', global: 'FormattingUtils' },
                { src: `${basePath}/error-system.js`, name: 'ErrorSystem', globals: ['ErrorCode', 'ErrorCategory', 'ErrorSeverity', 'AppError', 'ErrorFactory', 'ErrorHandler'] }
            ];

            console.log('🔄 Loading shared utilities...');

            for (const utility of utilities) {
                try {
                    await loadUtilityScript(utility.src, utility.name);
                    
                    // Verify the utility loaded correctly
                    if (utility.global) {
                        if (!window[utility.global]) {
                            throw new Error(`Global ${utility.global} not found after loading`);
                        }
                    } else if (utility.globals) {
                        for (const globalName of utility.globals) {
                            if (!window[globalName]) {
                                throw new Error(`Global ${globalName} not found after loading`);
                            }
                        }
                    }
                    
                    console.log(`✅ Loaded ${utility.name}`);
                } catch (error) {
                    console.error(`❌ Failed to load ${utility.name}:`, error);
                    
                    // Create fallback if critical
                    if (utility.name === 'Logger') {
                        createFallbackLogger();
                    } else if (utility.name === 'Constants') {
                        createFallbackConstants();
                    } else if (utility.name === 'TimerManager') {
                        createFallbackTimerManager();
                    } else if (utility.name === 'FormattingUtils') {
                        createFallbackFormattingUtils();
                    } else if (utility.name === 'ErrorSystem') {
                        createFallbackErrorSystem();
                    }
                }
            }

            console.log('✅ Shared utilities initialization complete');
            
            // Trigger ready event
            if (typeof window.CustomEvent !== 'undefined') {
                const event = new CustomEvent('sharedUtilsReady', {
                    detail: { loaded: window.SharedUtils.loaded }
                });
                window.dispatchEvent(event);
            }

        } catch (error) {
            console.error('❌ Shared utilities initialization failed:', error);
            
            // Create critical fallbacks
            createFallbackLogger();
            createFallbackConstants();
            createFallbackTimerManager();
            createFallbackFormattingUtils();
            createFallbackErrorSystem();
        }
    }

    /**
     * Create fallback logger if loading fails
     */
    function createFallbackLogger() {
        window.Logger = {
            debug: function(message, data, context) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] ${message}`, data || '');
                }
            },
            info: function(message, data, context) {
                console.info(`[INFO] ${message}`, data || '');
            },
            warn: function(message, data, context) {
                console.warn(`[WARN] ${message}`, data || '');
            },
            error: function(message, error, context) {
                console.error(`[ERROR] ${message}`, error || '');
            },
            uploadProgress: function(fileName, progress, transferId) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] Upload progress: ${fileName} - ${progress.toFixed(1)}%`);
                }
            },
            downloadProgress: function(fileName, progress, downloadId) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] Download progress: ${fileName} - ${progress.toFixed(1)}%`);
                }
            },
            image: function(operation, details) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] Image ${operation}`, details);
                }
            },
            network: function(quality, speed, details) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] Network quality: ${quality}`, { speed, ...details });
                }
            },
            performance: function(operation, duration, details) {
                if (window.SHARED_CONFIG.DEBUG) {
                    console.log(`[DEBUG] Performance: ${operation} completed in ${duration}ms`, details);
                }
            }
        };
        
        console.log('⚠️ Using fallback Logger');
    }

    /**
     * Create fallback constants if loading fails
     */
    function createFallbackConstants() {
        // File constants
        window.FILE_CONSTANTS = {
            CHUNK_THRESHOLD: 50 * 1024 * 1024,
            CHUNK_SIZE: 5 * 1024 * 1024,
            MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024,
            MIN_CHUNK_SIZE: 1024 * 1024,
            MAX_CHUNK_SIZE: 20 * 1024 * 1024,
            STREAM_CHUNK_SIZE: 64 * 1024,
            BYTES_PER_KB: 1024,
            BYTES_PER_MB: 1024 * 1024,
            BYTES_PER_GB: 1024 * 1024 * 1024,
            BYTES_PER_TB: 1024 * 1024 * 1024 * 1024
        };

        // Timeout constants
        window.TIMEOUT_CONSTANTS = {
            RETRY_BASE_DELAY: 1000,
            RETRY_MAX_DELAY: 30000,
            MAX_RETRIES: 3,
            UPLOAD_TIMEOUT: 300000,
            DOWNLOAD_TIMEOUT: 300000,
            IMAGE_LOAD_TIMEOUT: 30000,
            REQUEST_TIMEOUT: 10000,
            PROGRESS_UPDATE_INTERVAL: 500,
            BATCH_DELAY: 100,
            NOTIFICATION_TIMEOUT: 3000,
            DEBOUNCE_DELAY: 300,
            THROTTLE_DELAY: 200,
            MODAL_CLOSE_DELAY: 100,
            AUTO_REFRESH_DELAY: 200,
            FOCUS_DELAY: 0
        };

        // Network constants
        window.NETWORK_CONSTANTS = {
            MAX_CONCURRENT_UPLOADS: 3,
            MAX_CONCURRENT_DOWNLOADS: 3,
            SPEED_SAMPLE_SIZE: 10,
            SPEED_HISTORY_RETENTION: 30,
            ADJUSTMENT_FACTOR: 0.2,
            MIN_CHUNK_SIZE_ADAPTIVE: 256 * 1024,
            MAX_CHUNK_SIZE_ADAPTIVE: 10 * 1024 * 1024,
            NETWORK_THRESHOLDS: {
                EXCELLENT: 10 * 1024 * 1024,
                GOOD: 5 * 1024 * 1024,
                FAIR: 1 * 1024 * 1024,
                POOR: 0
            }
        };

        // Priority constants
        window.PRIORITY_CONSTANTS = {
            CRITICAL: 0,
            HIGH: 1,
            NORMAL: 2,
            LOW: 3,
            BACKGROUND: 4,
            NOTIFICATION_TYPES: {
                SUCCESS: 'success',
                ERROR: 'error',
                WARNING: 'warning',
                INFO: 'info'
            },
            CONNECTION_QUALITY: {
                EXCELLENT: 'EXCELLENT',
                GOOD: 'GOOD',
                FAIR: 'FAIR',
                POOR: 'POOR',
                UNKNOWN: 'UNKNOWN'
            }
        };

        // Other essential constants
        window.FILE_TYPE_CONSTANTS = {
            SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'],
            SIZE_CATEGORIES: ['Bytes', 'KB', 'MB', 'GB', 'TB']
        };

        window.DEBUG_CONSTANTS = {
            PERFORMANCE_SAMPLE_INTERVAL: 1000
        };

        console.log('⚠️ Using fallback Constants');
    }

    /**
     * Create fallback timer manager if loading fails
     */
    function createFallbackTimerManager() {
        window.TimerManager = {
            timers: new Map(),
            setTimeout: function(callback, delay, context) {
                const id = setTimeout(() => {
                    this.clearTimer(id);
                    callback();
                }, delay);
                this.timers.set(id, { callback, delay, context });
                return id;
            },
            clearTimer: function(id) {
                clearTimeout(id);
                this.timers.delete(id);
            },
            clearAllTimers: function() {
                let count = 0;
                for (const id of this.timers.keys()) {
                    clearTimeout(id);
                    count++;
                }
                this.timers.clear();
                return count;
            }
        };

        console.log('⚠️ Using fallback TimerManager');
    }

    /**
     * Create fallback formatting utils if loading fails
     */
    function createFallbackFormattingUtils() {
        window.FormattingUtils = {
            formatFileSize: function(bytes) {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            },
            formatTime: function(seconds) {
                if (!seconds || seconds < 0) return '—';
                if (seconds < 60) return Math.round(seconds) + 's';
                if (seconds < 3600) return Math.round(seconds / 60) + 'm';
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.round((seconds % 3600) / 60);
                return `${hours}h ${minutes}m`;
            },
            formatSpeed: function(bytesPerSecond) {
                if (!bytesPerSecond) return '—';
                return this.formatFileSize(bytesPerSecond) + '/s';
            }
        };

        console.log('⚠️ Using fallback FormattingUtils');
    }

    /**
     * Create fallback error system if loading fails
     */
    function createFallbackErrorSystem() {
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
        window.AppError = function(code, message, statusCode = 500, category = window.ErrorCategory.SYSTEM, severity = window.ErrorSeverity.MEDIUM, context = {}) {
            this.code = code;
            this.message = message;
            this.statusCode = statusCode;
            this.category = category;
            this.severity = severity;
            this.context = context;
            this.timestamp = new Date().toISOString();
            this.name = 'AppError';
            
            Error.captureStackTrace?.(this, this.constructor);
        };
        window.AppError.prototype = Object.create(Error.prototype);
        window.AppError.prototype.constructor = window.AppError;

        // Error factory
        window.ErrorFactory = {
            createValidationError: function(message, details) {
                return new window.AppError(
                    window.ErrorCode.VALIDATION_FAILED,
                    message,
                    400,
                    window.ErrorCategory.VALIDATION,
                    window.ErrorSeverity.MEDIUM,
                    details
                );
            },
            
            createUploadError: function(message, details) {
                return new window.AppError(
                    window.ErrorCode.UPLOAD_FAILED,
                    message,
                    500,
                    window.ErrorCategory.UPLOAD,
                    window.ErrorSeverity.HIGH,
                    details
                );
            },
            
            createNetworkError: function(message, details) {
                return new window.AppError(
                    window.ErrorCode.NETWORK_ERROR,
                    message,
                    503,
                    window.ErrorCategory.NETWORK,
                    window.ErrorSeverity.HIGH,
                    details
                );
            },
            
            createError: function(code, message, statusCode = 500, category = window.ErrorCategory.SYSTEM, details = {}) {
                return new window.AppError(code, message, statusCode, category, window.ErrorSeverity.MEDIUM, details);
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
                    [window.ErrorCode.PERMISSION_DENIED]: 'You do not have permission to perform this action.'
                };

                return messageMap[error.code] || 'An error occurred. Please try again.';
            }
        };

        console.log('⚠️ Using fallback ErrorSystem');
    }

    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSharedUtilities);
    } else {
        initializeSharedUtilities();
    }

})();