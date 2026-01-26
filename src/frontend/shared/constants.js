/**
 * Constants - JavaScript version
 * Provides application-wide constants
 */

(function() {
    'use strict';

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

    window.STORAGE_CONSTANTS = {
        PREFIX: 's3_viewer_',
        KEYS: {
            BUCKET_PREFERENCE: 'bucket_preference',
            USER_SETTINGS: 'user_settings',
            UPLOAD_HISTORY: 'upload_history'
        }
    };

    window.ERROR_CONSTANTS = {
        DEFAULT_MESSAGE: 'An unexpected error occurred',
        TIMEOUT_MESSAGE: 'Request timed out',
        NETWORK_ERROR_MESSAGE: 'Network connection error',
        VALIDATION_ERROR_MESSAGE: 'Invalid input provided'
    };

    window.UI_CONSTANTS = {
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 300,
        TOAST_DURATION: 3000,
        MODAL_BACKDROP: true,
        MAX_NOTIFICATIONS: 5
    };

    window.API_CONSTANTS = {
        BASE_URL: '/api/v1',
        ENDPOINTS: {
            FILES: '/files',
            BUCKETS: '/buckets',
            UPLOAD: '/upload',
            DOWNLOAD: '/download',
            INFO: '/info',
            PREVIEW: '/preview'
        },
        METHODS: {
            GET: 'GET',
            POST: 'POST',
            PUT: 'PUT',
            DELETE: 'DELETE',
            PATCH: 'PATCH'
        }
    };

    window.INPUT_CONSTANTS = {
        MAX_FILENAME_LENGTH: 255,
        MAX_PATH_LENGTH: 1024,
        FORBIDDEN_CHARS: ['<', '>', ':', '"', '|', '?', '*'],
        RESERVED_NAMES: ['CON', 'PRN', 'AUX', 'NUL']
    };

    window.MATH_CONSTANTS = {
        KB: 1024,
        MB: 1024 * 1024,
        GB: 1024 * 1024 * 1024,
        TB: 1024 * 1024 * 1024 * 1024
    };

    window.SECURITY_CONSTANTS = {
        MAX_FILE_SIZE_PREVIEW: 10 * 1024 * 1024, // 10MB
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
        CORS_MAX_AGE: 86400,
        RATE_LIMIT_WINDOW: 60000 // 1 minute
    };

    window.DEBUG_CONSTANTS = {
        PERFORMANCE_SAMPLE_INTERVAL: 1000,
        LOG_LEVEL: 'info',
        ENABLE_CONSOLE_LOGGING: true
    };

    console.log('✅ Constants loaded');
})();