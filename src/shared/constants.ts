/**
 * Centralized Constants
 * Extracts all magic numbers from the codebase for maintainability
 */

/**
 * File Operation Constants
 */
export const FILE_CONSTANTS = {
  // File size thresholds (in bytes)
  CHUNK_THRESHOLD: 50 * 1024 * 1024, // 50MB - threshold for chunked uploads
  CHUNK_SIZE: 5 * 1024 * 1024, // 5MB - default chunk size for multipart uploads
  MAX_FILE_SIZE: 2 * 1024 * 1024 * 1024, // 2GB - maximum allowed file size
  MIN_CHUNK_SIZE: 1024 * 1024, // 1MB - minimum chunk size
  MAX_CHUNK_SIZE: 20 * 1024 * 1024, // 20MB - maximum chunk size
  STREAM_CHUNK_SIZE: 64 * 1024, // 64KB - chunk size for streaming operations
  
  // File size calculations
  BYTES_PER_KB: 1024,
  BYTES_PER_MB: 1024 * 1024,
  BYTES_PER_GB: 1024 * 1024 * 1024,
  BYTES_PER_TB: 1024 * 1024 * 1024 * 1024,
} as const;

/**
 * Operation Timeout Constants (in milliseconds)
 */
export const TIMEOUT_CONSTANTS = {
  // Retry and retry delays
  RETRY_BASE_DELAY: 1000, // 1 second - base delay for exponential backoff
  RETRY_MAX_DELAY: 30000, // 30 seconds - maximum retry delay
  MAX_RETRIES: 3, // Maximum number of retry attempts
  
  // Operation timeouts
  UPLOAD_TIMEOUT: 300000, // 5 minutes - maximum upload time
  DOWNLOAD_TIMEOUT: 300000, // 5 minutes - maximum download time
  IMAGE_LOAD_TIMEOUT: 30000, // 30 seconds - image loading timeout
  REQUEST_TIMEOUT: 10000, // 10 seconds - general request timeout
  
  // Progress and batching
  PROGRESS_UPDATE_INTERVAL: 500, // 0.5 seconds - progress update frequency
  BATCH_DELAY: 100, // 100ms - delay between batch operations
  NOTIFICATION_TIMEOUT: 3000, // 3 seconds - notification display time
  DEBOUNCE_DELAY: 300, // 300ms - debounce delay for user inputs
  THROTTLE_DELAY: 200, // 200ms - throttle delay for frequent operations
  
  // UI delays
  MODAL_CLOSE_DELAY: 100, // 100ms - delay before modal close animation
  AUTO_REFRESH_DELAY: 200, // 200ms - delay for auto-refresh operations
  FOCUS_DELAY: 0, // 0ms - immediate focus change
  RESIZE_DEBOUNCE: 0, // 0ms - immediate resize handling
  FULLSCREEN_DELAY: 0, // 0ms - immediate fullscreen operations
} as const;

/**
 * Network and Performance Constants
 */
export const NETWORK_CONSTANTS = {
  // Concurrent operations
  MAX_CONCURRENT_UPLOADS: 3, // Maximum simultaneous uploads
  MAX_CONCURRENT_DOWNLOADS: 3, // Maximum simultaneous downloads
  MAX_CONCURRENT_OPERATIONS: 5, // Maximum concurrent file operations
  
  // Speed and quality measurements
  SPEED_SAMPLE_SIZE: 10, // Number of speed samples for averaging
  SPEED_HISTORY_RETENTION: 30, // Seconds to retain speed history
  
  // Adaptive chunking
  ADJUSTMENT_FACTOR: 0.2, // 20% - chunk size adjustment factor
  MIN_CHUNK_SIZE_ADAPTIVE: 256 * 1024, // 256KB - minimum adaptive chunk size
  MAX_CHUNK_SIZE_ADAPTIVE: 10 * 1024 * 1024, // 10MB - maximum adaptive chunk size
  
  // Network quality thresholds (bytes per second)
  NETWORK_THRESHOLDS: {
    EXCELLENT: 10 * 1024 * 1024, // 10 MB/s
    GOOD: 5 * 1024 * 1024, // 5 MB/s
    FAIR: 1 * 1024 * 1024, // 1 MB/s
    POOR: 0, // < 1 MB/s
  },
  
  // Bandwidth calculations
  MAX_BANDWIDTH_REFERENCE: 100 * 1024 * 1024, // 100 MB/s reference for percentage
} as const;

/**
 * UI and Display Constants
 */
export const UI_CONSTANTS = {
  // Viewport and layout
  VIEWPORT_PADDING: 40, // Pixels - padding for image viewport
  MODAL_OVERLAY_ZINDEX: 9999,
  NOTIFICATION_ZINDEX: 10000,
  
  // Zoom controls
  ZOOM_STEP: 0.1, // Zoom increment/decrement
  MIN_ZOOM: 0.1, // Minimum zoom level
  MAX_ZOOM: 10, // Maximum zoom level
  DEFAULT_ZOOM: 1, // Default/actual size zoom
  
  // Touch gestures
  DOUBLE_TAP_THRESHOLD: 300, // Milliseconds - double tap detection
  PINCH_ZOOM_SENSITIVITY: 1, // Multiplier for pinch zoom
  
  // Animations and transitions
  TRANSITION_DURATION: 300, // Milliseconds - UI transition duration
  FAST_TRANSITION: 150, // Milliseconds - quick transitions
  SLOW_TRANSITION: 500, // Milliseconds - slow transitions
  
  // Loading and progress
  LOADING_INDICATOR_SIZE: 50, // Pixels - loading spinner size
  PROGRESS_BAR_HEIGHT: 4, // Pixels - progress bar thickness
  
  // Grid and list views
  GRID_ITEM_MIN_WIDTH: 150, // Pixels - minimum grid item width
  LIST_ITEM_HEIGHT: 60, // Pixels - list item height
  LIST_HEADER_HEIGHT: 50, // Pixels - list header height
} as const;

/**
 * File Type and Validation Constants
 */
export const FILE_TYPE_CONSTANTS = {
  // Supported image formats
  SUPPORTED_IMAGE_FORMATS: [
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'
  ] as const,
  
  // Supported document formats
  SUPPORTED_DOCUMENT_FORMATS: [
    'pdf', 'doc', 'docx', 'txt', 'csv', 'json', 'xml'
  ] as const,
  
  // File size categories (for display)
  SIZE_CATEGORIES: ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const,
  
  // Validation patterns
  DANGEROUS_PATTERNS: [
    /\.\./, // Directory traversal
    /[<>:"\\|?*]/, // Invalid file name characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
  ],
  
  // Maximum file name length
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 2048,
} as const;

/**
 * Data Storage and Limits
 */
export const STORAGE_CONSTANTS = {
  // Progress tracking
  TRANSFER_HISTORY_LIMIT: 50, // Maximum transfer history entries
  PROGRESS_HISTORY_LIMIT: 50, // Maximum progress history points
  SPEED_HISTORY_LIMIT: 50, // Maximum speed history points
  
  // Memory management
  MAX_LOG_ENTRIES: 1000, // Maximum log entries in memory
  MAX_CACHE_SIZE: 100, // Maximum cached items
  CACHE_EXPIRY_MS: 300000, // 5 minutes - cache expiry time
  
  // Local storage keys
  STORAGE_KEYS: {
    USER_PREFERENCES: 's3-viewer-preferences',
    BUCKET_STATE: 's3-viewer-bucket-state',
    TRANSFER_CACHE: 's3-viewer-transfers',
    UI_STATE: 's3-viewer-ui-state',
  } as const,
} as const;

/**
 * Error and Status Constants
 */
export const ERROR_CONSTANTS = {
  // HTTP status codes
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  
  // Error types
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

/**
 * Classification and Priority Constants
 */
export const PRIORITY_CONSTANTS = {
  // Transfer priorities (lower number = higher priority)
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4,
  
  // Notification types
  NOTIFICATION_TYPES: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
  } as const,
  
  // Connection quality levels
  CONNECTION_QUALITY: {
    EXCELLENT: 'EXCELLENT',
    GOOD: 'GOOD',
    FAIR: 'FAIR',
    POOR: 'POOR',
    UNKNOWN: 'UNKNOWN',
  } as const,
} as const;

/**
 * API Endpoints and Paths
 */
export const API_CONSTANTS = {
  // API version
  API_VERSION: 'v1',
  
  // Base paths
  API_BASE: '/api',
  FILES_BASE: '/files',
  BUCKETS_BASE: '/buckets',
  
  // File operation endpoints
  ENDPOINTS: {
    LIST_FILES: '/list',
    UPLOAD_FILE: '/upload',
    DOWNLOAD_FILE: '/download',
    STREAM_FILE: '/stream',
    PREVIEW_FILE: '/preview',
    FILE_INFO: '/info',
    DELETE_ITEM: '/delete',
    CREATE_FOLDER: '/folder',
  } as const,
  
  // Bucket operation endpoints
  BUCKET_ENDPOINTS: {
    LIST_BUCKETS: '',
    VALIDATE_BUCKETS: '/validate',
    SWITCH_BUCKET: '/switch',
  } as const,
} as const;

/**
 * Keyboard and Input Constants
 */
export const INPUT_CONSTANTS = {
  // Keyboard shortcuts
  KEYBOARD_SHORTCUTS: {
    ZOOM_IN: ['+', '=', '='],
    ZOOM_OUT: ['-', '_'],
    RESET_ZOOM: ['0'],
    FIT_TO_SCREEN: ['f', 'F'],
    ROTATE_LEFT: ['l', 'L', 'ArrowLeft'],
    ROTATE_RIGHT: ['r', 'R', 'ArrowRight'],
    DOWNLOAD: ['d', 'D'],
    TOGGLE_INFO: ['i', 'I'],
    TOGGLE_FULLSCREEN: ['F11'],
    SHOW_HELP: ['?', 'h', 'H'],
    CLOSE: ['Escape'],
  } as const,
  
  // Touch and gesture constants
  TOUCH_CONSTANTS: {
    MIN_TOUCH_DISTANCE: 10, // Minimum pixels for touch move
    MAX_TAP_DURATION: 200, // Maximum milliseconds for tap
    SWIPE_THRESHOLD: 50, // Minimum pixels for swipe
    PINCH_SENSITIVITY: 1, // Pinch zoom sensitivity
  } as const,
  
  // Mouse constants
  MOUSE_CONSTANTS: {
    DOUBLE_CLICK_DELAY: 300, // Milliseconds
    DRAG_THRESHOLD: 5, // Minimum pixels for drag
    WHEEL_SCROLL_SENSITIVITY: 1, // Mouse wheel sensitivity
  } as const,
} as const;

/**
 * Mathematics and Calculation Constants
 */
export const MATH_CONSTANTS = {
  // Percentage calculations
  PERCENTAGE_MULTIPLIER: 100,
  PERCENTAGE_PRECISION: 1, // Decimal places for percentages
  
  // Speed calculations
  BYTES_PER_SECOND_MULTIPLIER: 1000, // For ms to seconds conversion
  
  // Size calculations
  LOG_BASE_1024: Math.log(1024),
  
  // Rounding and formatting
  FILE_SIZE_PRECISION: 2, // Decimal places for file sizes
  SPEED_PRECISION: 2, // Decimal places for speeds
  
  // Progress calculations
  PROGRESS_PRECISION: 1, // Decimal places for progress
  MIN_PROGRESS_FOR_UPDATE: 0.1, // Minimum progress change to trigger update
} as const;

/**
 * CORS and Security Constants
 */
export const SECURITY_CONSTANTS = {
  // CORS settings
  CORS_ORIGINS: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173', // Vite default
    'http://127.0.0.1:5173',
  ],
  
  CORS_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  CORS_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
  CORS_MAX_AGE: 86400, // 24 hours
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100, // Per window
  
  // Security headers
  MAX_FILE_NAME_LENGTH: 255,
  MAX_PATH_DEPTH: 10,
} as const;

/**
 * Development and Debugging Constants
 */
export const DEBUG_CONSTANTS = {
  // Debug logging levels
  DEBUG_CONTEXTS: [
    'upload', 'download', 'transfer', 'image', 'network', 'performance'
  ] as const,
  
  // Development settings
  DEV_SERVER_PORT: 3000,
  DEV_SERVER_HOST: 'localhost',
  
  // Mock data settings
  MOCK_DELAY_MIN: 100, // Minimum mock response delay
  MOCK_DELAY_MAX: 1000, // Maximum mock response delay
  
  // Performance monitoring
  PERFORMANCE_SAMPLE_INTERVAL: 1000, // 1 second
  PERFORMANCE_HISTORY_SIZE: 60, // Keep 60 samples
} as const;

// Type exports for better TypeScript support
export type FileConstants = typeof FILE_CONSTANTS;
export type TimeoutConstants = typeof TIMEOUT_CONSTANTS;
export type NetworkConstants = typeof NETWORK_CONSTANTS;
export type UIConstants = typeof UI_CONSTANTS;
export type FileTypeConstants = typeof FILE_TYPE_CONSTANTS;
export type StorageConstants = typeof STORAGE_CONSTANTS;
export type ErrorConstants = typeof ERROR_CONSTANTS;
export type PriorityConstants = typeof PRIORITY_CONSTANTS;
export type APIConstants = typeof API_CONSTANTS;
export type InputConstants = typeof INPUT_CONSTANTS;
export type MathConstants = typeof MATH_CONSTANTS;
export type SecurityConstants = typeof SECURITY_CONSTANTS;
export type DebugConstants = typeof DEBUG_CONSTANTS;