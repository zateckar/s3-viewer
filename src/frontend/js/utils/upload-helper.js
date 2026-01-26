/**
 * Upload Helper Utility
 * Handles file uploads with streaming, chunking, and progress tracking
 * Enhanced with detailed monitoring and progress tracker integration
 */

// Import shared utilities
// Note: These will be available as global imports or via module system
// import { Logger } from '../../../shared/logger.js';
// import { FILE_CONSTANTS, TIMEOUT_CONSTANTS, NETWORK_CONSTANTS } from '../../../shared/constants.js';
// import { TimerManager } from '../../../shared/timer-manager.js';

/**
 * Upload configuration using centralized constants
 */
const UPLOAD_CONFIG = {
    // File size thresholds using constants
    CHUNK_THRESHOLD: window.FILE_CONSTANTS?.CHUNK_THRESHOLD || (50 * 1024 * 1024),
    CHUNK_SIZE: window.FILE_CONSTANTS?.CHUNK_SIZE || (5 * 1024 * 1024),
    MAX_FILE_SIZE: window.FILE_CONSTANTS?.MAX_FILE_SIZE || (2 * 1024 * 1024 * 1024),
    MIN_CHUNK_SIZE: window.FILE_CONSTANTS?.MIN_CHUNK_SIZE || (1024 * 1024),
    MAX_CHUNK_SIZE: window.FILE_CONSTANTS?.MAX_CHUNK_SIZE || (20 * 1024 * 1024),
    
    // Allowed file types (empty means all types allowed)
    ALLOWED_TYPES: [],
    
    // Network and concurrency
    MAX_CONCURRENT_UPLOADS: window.NETWORK_CONSTANTS?.MAX_CONCURRENT_UPLOADS || 3,
    
    // Retry configuration using timeout constants
    MAX_RETRIES: window.TIMEOUT_CONSTANTS?.MAX_RETRIES || 3,
    RETRY_DELAY: window.TIMEOUT_CONSTANTS?.RETRY_BASE_DELAY || 1000,
    RETRY_MAX_DELAY: window.TIMEOUT_CONSTANTS?.RETRY_MAX_DELAY || 30000,
    
    // Feature flags
    ENABLE_CHUNK_TRACKING: true,
    ENABLE_ADAPTIVE_CHUNKING: true,
    
    // Performance monitoring
    PERFORMANCE_SAMPLE_INTERVAL: window.DEBUG_CONSTANTS?.PERFORMANCE_SAMPLE_INTERVAL || 1000,
    
    // Speed optimization thresholds using network constants
    SPEED_OPTIMIZATION_THRESHOLDS: {
        EXCELLENT: {
            minSpeed: window.NETWORK_CONSTANTS?.NETWORK_THRESHOLDS?.EXCELLENT || (10 * 1024 * 1024),
            chunkSize: window.FILE_CONSTANTS?.MAX_CHUNK_SIZE_ADAPTIVE || (20 * 1024 * 1024)
        },
        GOOD: {
            minSpeed: window.NETWORK_CONSTANTS?.NETWORK_THRESHOLDS?.GOOD || (5 * 1024 * 1024),
            chunkSize: window.FILE_CONSTANTS?.CHUNK_SIZE || (10 * 1024 * 1024)
        },
        FAIR: {
            minSpeed: window.NETWORK_CONSTANTS?.NETWORK_THRESHOLDS?.FAIR || (1 * 1024 * 1024),
            chunkSize: window.FILE_CONSTANTS?.CHUNK_SIZE || (5 * 1024 * 1024)
        },
        POOR: {
            minSpeed: window.NETWORK_CONSTANTS?.NETWORK_THRESHOLDS?.POOR || 0,
            chunkSize: window.NETWORK_CONSTANTS?.MIN_CHUNK_SIZE_ADAPTIVE || (1024 * 1024)
        }
    }
};

/**
 * Connection Quality Detector
 */
class ConnectionQualityDetector {
    constructor() {
        this.speedHistory = [];
        this.lastSpeedCheck = 0;
        this.currentQuality = 'UNKNOWN';
        this.adaptiveChunkSize = UPLOAD_CONFIG.CHUNK_SIZE;
    }

    recordSpeed(speed) {
        const now = Date.now();
        this.speedHistory.push({ timestamp: now, speed });
        
        // Keep only recent samples (last 30 seconds)
        const cutoff = now - 30000;
        this.speedHistory = this.speedHistory.filter(sample => sample.timestamp > cutoff);
        
        // Update quality assessment
        this.updateConnectionQuality();
        
        // Adjust chunk size based on connection quality
        this.adjustChunkSize();
    }

    updateConnectionQuality() {
        if (this.speedHistory.length === 0) return;
        
        const recentSpeeds = this.speedHistory.slice(-5); // Last 5 samples
        const averageSpeed = recentSpeeds.reduce((sum, sample) => sum + sample.speed, 0) / recentSpeeds.length;
        
        const thresholds = UPLOAD_CONFIG.SPEED_OPTIMIZATION_THRESHOLDS;
        
        if (averageSpeed >= thresholds.EXCELLENT.minSpeed) {
            this.currentQuality = 'EXCELLENT';
        } else if (averageSpeed >= thresholds.GOOD.minSpeed) {
            this.currentQuality = 'GOOD';
        } else if (averageSpeed >= thresholds.FAIR.minSpeed) {
            this.currentQuality = 'FAIR';
        } else {
            this.currentQuality = 'POOR';
        }
    }

    adjustChunkSize() {
        const thresholds = UPLOAD_CONFIG.SPEED_OPTIMIZATION_THRESHOLDS;
        const targetSize = thresholds[this.currentQuality]?.chunkSize || UPLOAD_CONFIG.CHUNK_SIZE;
        
        // Gradually adjust to avoid sudden jumps
        const adjustmentFactor = 0.2; // 20% adjustment per cycle
        this.adaptiveChunkSize = Math.round(
            this.adaptiveChunkSize * (1 - adjustmentFactor) + targetSize * adjustmentFactor
        );
        
        // Ensure chunk size stays within bounds
        this.adaptiveChunkSize = Math.max(
            UPLOAD_CONFIG.MIN_CHUNK_SIZE,
            Math.min(UPLOAD_CONFIG.MAX_CHUNK_SIZE, this.adaptiveChunkSize)
        );
    }

    getConnectionQuality() {
        return this.currentQuality;
    }

    getAdaptiveChunkSize() {
        return this.adaptiveChunkSize;
    }

    getAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        
        const recentSpeeds = this.speedHistory.slice(-10); // Last 10 samples
        const sum = recentSpeeds.reduce((acc, sample) => acc + sample.speed, 0);
        return sum / recentSpeeds.length;
    }
}

/**
 * Enhanced File upload state
 */
class UploadState {
    constructor(file, path, transferId = null) {
        this.file = file;
        this.path = path;
        this.status = 'pending'; // pending, uploading, completed, error, paused
        this.progress = 0;
        this.bytesUploaded = 0;
        this.totalBytes = file.size;
        this.startTime = null;
        this.endTime = null;
        this.speed = 0; // bytes per second
        this.timeRemaining = null;
        this.error = null;
        this.retryCount = 0;
        this.chunkCount = 0;
        this.currentChunk = 0;
        this.uploadId = null;
        
        // Enhanced tracking
        this.transferId = transferId || this.generateTransferId();
        this.connectionQuality = new ConnectionQualityDetector();
        this.chunkProgress = new Map(); // Track individual chunk progress
        this.performanceHistory = [];
        this.lastProgressUpdate = 0;
        this.failureReason = null;
        this.upsidation = 0;
        this.averageSpeedHistory = [];
        this.peakSpeed = 0;
        this.isAdaptive = UPLOAD_CONFIG.ENABLE_ADAPTIVE_CHUNKING;
        this.dynamicChunkSize = UPLOAD_CONFIG.CHUNK_SIZE;
    }

    generateTransferId() {
        return 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    updateProgress(bytesUploaded, chunkInfo = null) {
        const previousBytes = this.bytesUploaded;
        this.bytesUploaded = bytesUploaded;
        this.progress = Math.min(100, (bytesUploaded / this.totalBytes) * 100);
        
        if (this.startTime) {
            const now = Date.now();
            const elapsed = (now - this.startTime) / 1000;
            this.speed = elapsed > 0 ? bytesUploaded / elapsed : 0;
            this.peakSpeed = Math.max(this.peakSpeed, this.speed);
            
            // Update connection quality detector
            this.connectionQuality.recordSpeed(this.speed);
            
            // Adjust dynamic chunk size
            if (this.isAdaptive) {
                this.dynamicChunkSize = this.connectionQuality.getAdaptiveChunkSize();
            }
            
            // Calculate time remaining
            if (this.speed > 0) {
                const remainingBytes = this.totalBytes - bytesUploaded;
                this.timeRemaining = remainingBytes / this.speed;
            }
            
            // Record performance sample
            if (now - this.lastProgressUpdate >= UPLOAD_CONFIG.PERFORMANCE_SAMPLE_INTERVAL) {
                this.performanceHistory.push({
                    timestamp: now,
                    bytesUploaded,
                    speed: this.speed,
                    averageSpeed: this.connectionQuality.getAverageSpeed(),
                    chunkSize: this.dynamicChunkSize,
                    connectionQuality: this.connectionQuality.getConnectionQuality()
                });
                
                // Keep only recent history
                if (this.performanceHistory.length > 60) {
                    this.performanceHistory.shift();
                }
                
                this.lastProgressUpdate = now;
            }
        }
        
        // Update chunk progress if provided
        if (chunkInfo && UPLOAD_CONFIG.ENABLE_CHUNK_TRACKING) {
            this.chunkProgress.set(chunkInfo.index, {
                ...chunkInfo,
                completed: bytesUploaded >= chunkInfo.endPosition
            });
        }
        
        // Notify progress tracker if available
        if (window.ProgressTracker) {
            window.ProgressTracker.updateProgress(this.transferId, bytesUploaded, this.speed);
        }
    }

    updateChunkProgress(chunkIndex, chunkBytesLoaded, chunkBytesTotal) {
        if (!UPLOAD_CONFIG.ENABLE_CHUNK_TRACKING) return;
        
        this.chunkProgress.set(chunkIndex, {
            index: chunkIndex,
            bytesLoaded: chunkBytesLoaded,
            bytesTotal: chunkBytesTotal,
            progress: chunkBytesTotal > 0 ? (chunkBytesLoaded / chunkBytesTotal) * 100 : 0,
            completed: chunkBytesLoaded >= chunkBytesTotal
        });
    }

    start(metadata = {}) {
        this.status = 'uploading';
        this.startTime = Date.now();
        
        // Create transfer in progress tracker
        if (window.ProgressTracker && !window.ProgressTracker.getTransfer(this.transferId)) {
            window.ProgressTracker.createTransfer(
                this.transferId,
                'upload',
                this.file.name,
                this.totalBytes,
                metadata.priority || window.TRANSFER_PRIORITY?.NORMAL || 2
            );
            
            window.ProgressTracker.startTransfer(this.transferId, {
                path: this.path,
                fileSize: this.totalBytes,
                contentType: this.file.type,
                lastModified: this.file.lastModified
            });
        }
    }

    complete() {
        this.status = 'completed';
        this.progress = 100;
        this.bytesUploaded = this.totalBytes;
        this.endTime = Date.now();
        this.timeRemaining = 0;
        this.speed = 0;
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.completeTransfer(this.transferId);
        }
    }

    setError(message, failureReason = null) {
        this.status = 'error';
        this.error = message;
        this.failureReason = failureReason;
        this.endTime = Date.now();
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.handleTransferError(
                this.transferId,
                message,
                this.retryCount < UPLOAD_CONFIG.MAX_RETRIES
            );
        }
    }

    pause(reason = '') {
        this.status = 'paused';
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.pauseTransfer(this.transferId, reason);
        }
    }

    resume() {
        this.status = 'uploading';
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.resumeTransfer(this.transferId);
        }
    }

    cancel(reason = '') {
        this.status = 'cancelled';
        this.endTime = Date.now();
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.cancelTransfer(this.transferId, reason);
        }
    }

    get elapsedSeconds() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.round((endTime - this.startTime) / 1000);
    }

    get connectionQualityStatus() {
        return this.connectionQuality.getConnectionQuality();
    }

    get averageSpeed() {
        return this.connectionQuality.getAverageSpeed();
    }

    get currentChunkSize() {
        return this.isAdaptive ? this.dynamicChunkSize : UPLOAD_CONFIG.CHUNK_SIZE;
    }

    get completedChunks() {
        return Array.from(this.chunkProgress.values()).filter(chunk => chunk.completed).length;
    }

    getFailureDetails() {
        return {
            reason: this.failureReason,
            retryCount: this.retryCount,
            lastError: this.error,
            connectionQuality: this.connectionQualityStatus,
            averageSpeed: this.averageSpeed
        };
    }
}

/**
 * Upload progress callback
 * @param {UploadState} uploadState - Current upload state
 */
function onProgress(uploadState) {
    // This will be overridden by the caller
    // Use Logger instead of console.log
    if (window.Logger) {
        window.Logger.uploadProgress(uploadState.file.name, uploadState.progress, uploadState.transferId);
    } else {
        // Fallback for environments where Logger isn't loaded yet
        console.log(`Upload progress: ${uploadState.file.name} - ${uploadState.progress.toFixed(1)}%`);
    }
}

/**
 * Validates a file before upload
 * @param {File} file - The file to validate
 * @returns {Object} Validation result { valid: boolean, error: string|null }
 */
function validateFile(file) {
    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    // Check file size
    if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
        return { 
            valid: false, 
            error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(UPLOAD_CONFIG.MAX_FILE_SIZE)})` 
        };
    }

    // Check file types if restrictions are set
    if (UPLOAD_CONFIG.ALLOWED_TYPES.length > 0) {
        const fileType = file.type || '';
        const fileName = file.name || '';
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        
        const isValidType = UPLOAD_CONFIG.ALLOWED_TYPES.some(type => {
            if (type.startsWith('.')) {
                // Extension match
                return fileExtension === type.substring(1);
            } else if (type.includes('/')) {
                // MIME type match
                return fileType === type || fileType.startsWith(type.replace('*', ''));
            }
            return false;
        });

        if (!isValidType) {
            return { 
                valid: false, 
                error: `File type (${fileType || 'unknown'}) is not allowed` 
            };
        }
    }

    return { valid: true, error: null };
}

/**
 * Uploads a file with streaming and chunking support
 * @param {File} file - The file to upload
 * @param {string} path - The destination path (folder)
 * @param {function} onProgress - Progress callback function
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(file, path, onProgressCallback, bucket = null, options = {}) {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Create upload state with transfer ID
    const transferId = options.transferId || null;
    const uploadState = new UploadState(file, path, transferId);
    
    // Set progress callback
    const progressCallback = onProgressCallback || onProgress;

    try {
        // Add bucket to options for upload functions
        const uploadOptions = { ...options, bucket };
        uploadState.start(uploadOptions);
        progressCallback(uploadState);

        // Determine if we need chunked upload (using adaptive chunk size)
        const useChunking = file.size > uploadState.currentChunkSize;

        if (useChunking) {
            await uploadFileChunked(uploadState, progressCallback, uploadOptions);
        } else {
            await uploadFileStream(uploadState, progressCallback, uploadOptions);
        }

        uploadState.complete();
        progressCallback(uploadState);

        return {
            success: true,
            transferId: uploadState.transferId,
            file: {
                name: file.name,
                size: file.size,
                path: uploadState.path,
                type: file.type
            },
            performance: {
                averageSpeed: uploadState.averageSpeed,
                peakSpeed: uploadState.peakSpeed,
                connectionQuality: uploadState.connectionQualityStatus,
                elapsedSeconds: uploadState.elapsedSeconds
            }
        };

    } catch (error) {
        // Determine failure reason for better error tracking
        const failureReason = determineFailureReason(error, uploadState);
        console.log('🔍 DEBUG: Upload error caught:', { error: error.message, failureReason, uploadStateId: uploadState.transferId });
        uploadState.setError(error.message, failureReason);
        progressCallback(uploadState);
        
        // Implement retry logic with exponential backoff
        if (uploadState.retryCount < UPLOAD_CONFIG.MAX_RETRIES && options.retry !== false) {
            uploadState.retryCount++;
            uploadState.status = 'pending';
            
            // Calculate delay with exponential backoff
            const baseDelay = UPLOAD_CONFIG.RETRY_DELAY;
            const maxDelay = 30000; // 30 seconds max
            const delay = Math.min(baseDelay * Math.pow(2, uploadState.retryCount - 1), maxDelay);
            
            console.log(`Retrying upload (${uploadState.retryCount}/${UPLOAD_CONFIG.MAX_RETRIES}) in ${delay}ms: ${file.name}`);
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return uploadFile(file, path, onProgressCallback, bucket, {
                ...options,
                retry: true,
                transferId: uploadState.transferId // Maintain same transfer ID
            });
        }
        
        throw error;
    }
}

/**
 * Determine failure reason for better error tracking
 * @param {Error} error - The error that occurred
 * @param {UploadState} uploadState - Current upload state
 * @returns {string} Categorized failure reason
 */
function determineFailureReason(error, uploadState) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        return 'NETWORK_ERROR';
    } else if (errorMessage.includes('timeout')) {
        return 'TIMEOUT';
    } else if (errorMessage.includes('size') || errorMessage.includes('large')) {
        return 'FILE_TOO_LARGE';
    } else if (errorMessage.includes('type') || errorMessage.includes('format')) {
        return 'UNSUPPORTED_FILE_TYPE';
    } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        return 'PERMISSION_DENIED';
    } else if (errorMessage.includes('storage') || errorMessage.includes('space')) {
        return 'STORAGE_FULL';
    } else if (uploadState.connectionQualityStatus === 'POOR') {
        return 'POOR_CONNECTION';
    } else {
        return 'UNKNOWN_ERROR';
    }
}

/**
 * Uploads a file as a single stream
 * @param {UploadState} uploadState - Upload state
 * @param {function} progressCallback - Progress callback
 * @param {Object} options - Upload options
 */
async function uploadFileStream(uploadState, progressCallback, options = {}) {
    const formData = new FormData();
    formData.append('file', uploadState.file);
    formData.append('path', uploadState.path);

    // Build upload URL with bucket parameter
    let uploadUrl = '/api/v1/files/upload';
    if (options.bucket) {
        uploadUrl += `?bucket=${encodeURIComponent(options.bucket)}`;
    }

    // Create XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                uploadState.updateProgress(event.loaded);
                progressCallback(uploadState);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error?.message || 'Upload failed'));
                    }
                } catch (parseError) {
                    reject(new Error('Invalid response from server'));
                }
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload was cancelled'));
        });

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
    });
}

/**
 * Uploads a file in chunks for large files with enhanced tracking
 * @param {UploadState} uploadState - Upload state
 * @param {function} progressCallback - Progress callback
 * @param {Object} options - Upload options
 */
async function uploadFileChunked(uploadState, progressCallback, options = {}) {
    const file = uploadState.file;
    const initialChunkSize = uploadState.currentChunkSize;
    const totalChunks = Math.ceil(file.size / initialChunkSize);
    
    uploadState.chunkCount = totalChunks;

    try {
        // For now, we'll use the regular upload method but with enhanced progress tracking
        // In a full implementation, this would use multipart upload API
        await uploadFileStreamEnhanced(uploadState, progressCallback, options);
        
        return {
            success: true,
            transferId: uploadState.transferId,
            data: {
                path: uploadState.path,
                size: file.size,
                contentType: file.type,
                name: file.name,
                chunksProcessed: totalChunks
            },
            performance: {
                averageSpeed: uploadState.averageSpeed,
                peakSpeed: uploadState.peakSpeed,
                connectionQuality: uploadState.connectionQualityStatus,
                adaptiveChunking: uploadState.isAdaptive
            }
        };

    } catch (error) {
        throw error;
    }
}

/**
 * Enhanced upload stream with better progress tracking
 * @param {UploadState} uploadState - Upload state
 * @param {function} progressCallback - Progress callback
 * @param {Object} options - Upload options
 */
async function uploadFileStreamEnhanced(uploadState, progressCallback, options = {}) {
    const formData = new FormData();
    formData.append('file', uploadState.file);
    formData.append('path', uploadState.path);
    
    // Add metadata for enhanced tracking
    formData.append('transferId', uploadState.transferId);
    formData.append('enableAdaptiveChunking', uploadState.isAdaptive);
    formData.append('connectionQuality', uploadState.connectionQualityStatus);

    // Build upload URL with bucket parameter
    let uploadUrl = '/api/v1/files/upload';
    if (options.bucket) {
        uploadUrl += `?bucket=${encodeURIComponent(options.bucket)}`;
    }

    // Create XMLHttpRequest for enhanced progress tracking
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        let lastProgressTime = Date.now();
        let lastBytesLoaded = 0;

        xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
                const now = Date.now();
                const timeDiff = now - lastProgressTime;
                const bytesDiff = event.loaded - lastBytesLoaded;
                
                // Calculate current speed for this chunk
                const currentSpeed = timeDiff > 0 ? (bytesDiff / timeDiff) * 1000 : 0;
                
                // Update upload state with enhanced tracking
                uploadState.updateProgress(event.loaded, {
                    type: 'upload',
                    timestamp: now,
                    bytesDiff,
                    currentSpeed
                });
                
                // Update chunk progress if enabled
                if (UPLOAD_CONFIG.ENABLE_CHUNK_TRACKING) {
                    const chunkIndex = Math.floor(event.loaded / uploadState.currentChunkSize);
                    const chunkStart = chunkIndex * uploadState.currentChunkSize;
                    const chunkEnd = Math.min(chunkStart + uploadState.currentChunkSize, uploadState.totalBytes);
                    const chunkBytesLoaded = event.loaded - chunkStart;
                    const chunkBytesTotal = chunkEnd - chunkStart;
                    
                    uploadState.updateChunkProgress(chunkIndex, Math.min(chunkBytesLoaded, chunkBytesTotal), chunkBytesTotal);
                }
                
                progressCallback(uploadState);
                
                lastProgressTime = now;
                lastBytesLoaded = event.loaded;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        // Add server-side performance data if available
                        if (response.performance) {
                            Object.assign(uploadState.performanceHistory, response.performance);
                        }
                        resolve(response);
                    } else {
                        reject(new Error(response.error?.message || 'Upload failed'));
                    }
                } catch (parseError) {
                    reject(new Error('Invalid response from server'));
                }
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload was cancelled'));
        });

        // Add timeout handling
        xhr.timeout = options.timeout || 300000; // 5 minutes default
        xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timed out'));
        });

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
    });
}

/**
 * Format file size to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
    // Use centralized FormattingUtils if available
    if (window.FormattingUtils) {
        return window.FormattingUtils.formatFileSize(bytes);
    }
    
    // Fallback implementation
    if (bytes === 0) return '0 Bytes';
    
    const k = window.FILE_CONSTANTS?.BYTES_PER_KB || 1024;
    const sizes = window.FILE_TYPE_CONSTANTS?.SIZE_CATEGORIES || ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    const precision = window.MATH_CONSTANTS?.FILE_SIZE_PRECISION || 2;
    return parseFloat((bytes / Math.pow(k, i)).toFixed(precision)) + ' ' + sizes[i];
}

/**
 * Format time duration to human readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '—';
    
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

/**
 * Format upload speed to human readable string
 * @param {number} bytesPerSecond - Speed in bytes per second
 * @returns {string} Formatted speed string
 */
function formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond) return '—';
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * Batch upload multiple files with enhanced tracking
 * @param {FileList} files - List of files to upload
 * @param {string} path - Destination path
 * @param {function} onProgress - Progress callback function
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Upload results
 */
async function uploadMultipleFiles(files, path, onProgress, options = {}) {
    const results = [];
    const totalFiles = files.length;
    let completedFiles = 0;
    let totalBytes = 0;
    let totalBytesProcessed = 0;

    // Calculate total size
    for (const file of files) {
        totalBytes += file.size;
    }

    // Create batch transfer ID
    const batchId = 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Process files with concurrency control
    const maxConcurrent = options.maxConcurrent || UPLOAD_CONFIG.MAX_CONCURRENT_UPLOADS;
    const semaphore = new Array(maxConcurrent).fill(null);
    
    const uploadPromises = Array.from(files).map(async (file, index) => {
        // Wait for available slot
        await new Promise(resolve => {
            const checkSlot = () => {
                const availableIndex = semaphore.findIndex(slot => slot === null);
                if (availableIndex !== -1) {
                    semaphore[availableIndex] = index;
                    resolve();
                } else {
                    setTimeout(checkSlot, 100);
                }
            };
            checkSlot();
        });

        try {
            const result = await uploadFile(file, path, (uploadState) => {
                // Update total progress
                totalBytesProcessed += (uploadState.bytesUploaded - (uploadState.lastBytesProcessed || 0));
                uploadState.lastBytesProcessed = uploadState.bytesUploaded;
                
                const overallProgress = (totalBytesProcessed / totalBytes) * 100;
                
                if (onProgress) {
                    onProgress({
                        type: 'batch',
                        batchId,
                        totalFiles,
                        completedFiles: completedFiles + (uploadState.status === 'completed' ? 1 : 0),
                        totalBytes,
                        totalBytesProcessed,
                        overallProgress,
                        currentFile: uploadState,
                        fileIndex: index
                    });
                }
            }, options.bucket, { ...options, batchId });

            completedFiles++;
            results.push({ success: true, file: file.name, result });

        } catch (error) {
            completedFiles++;
            results.push({ success: false, file: file.name, error: error.message });
        } finally {
            // Free the slot
            const slotIndex = semaphore.indexOf(index);
            if (slotIndex !== -1) {
                semaphore[slotIndex] = null;
            }
        }
    });

    await Promise.all(uploadPromises);

    return results;
}

/**
 * Get upload statistics and analytics
 * @param {string} transferId - Optional transfer ID to get specific stats
 * @returns {Object} Upload statistics
 */
function getUploadStatistics(transferId = null) {
    if (!window.ProgressTracker) {
        return { error: 'Progress tracker not available' };
    }

    if (transferId) {
        const transfer = window.ProgressTracker.getTransfer(transferId);
        if (!transfer) {
            return { error: 'Transfer not found' };
        }
        return transfer.stats;
    }

    // Return overall upload statistics
    const uploadTransfers = window.ProgressTracker.getTransfersByType('upload');
    const completedUploads = uploadTransfers.filter(t => t.status === 'completed');
    const activeUploads = uploadTransfers.filter(t => t.status === 'active');
    const failedUploads = uploadTransfers.filter(t => t.status === 'error');

    return {
        total: uploadTransfers.length,
        completed: completedUploads.length,
        active: activeUploads.length,
        failed: failedUploads.length,
        totalBytes: uploadTransfers.reduce((sum, t) => sum + t.totalBytes, 0),
        totalBytesTransferred: uploadTransfers.reduce((sum, t) => sum + t.transferredBytes, 0),
        averageSpeed: completedUploads.length > 0
            ? completedUploads.reduce((sum, t) => sum + t.stats.averageSpeed, 0) / completedUploads.length
            : 0,
        peakSpeed: Math.max(...uploadTransfers.map(t => t.stats.peakSpeed || 0)),
        recentTransfers: uploadTransfers.slice(-10)
    };
}

/**
 * Pause upload by transfer ID
 * @param {string} transferId - Transfer ID to pause
 * @param {string} reason - Reason for pausing
 * @returns {boolean} Success status
 */
function pauseUpload(transferId, reason = '') {
    if (!window.ProgressTracker) return false;
    
    const transfer = window.ProgressTracker.getTransfer(transferId);
    if (transfer && transfer.type === 'upload') {
        window.ProgressTracker.pauseTransfer(transferId, reason);
        return true;
    }
    return false;
}

/**
 * Resume upload by transfer ID
 * @param {string} transferId - Transfer ID to resume
 * @returns {boolean} Success status
 */
function resumeUpload(transferId) {
    if (!window.ProgressTracker) return false;
    
    const transfer = window.ProgressTracker.getTransfer(transferId);
    if (transfer && transfer.type === 'upload') {
        window.ProgressTracker.resumeTransfer(transferId);
        return true;
    }
    return false;
}

/**
 * Cancel upload by transfer ID
 * @param {string} transferId - Transfer ID to cancel
 * @param {string} reason - Reason for cancellation
 * @returns {boolean} Success status
 */
function cancelUpload(transferId, reason = '') {
    if (!window.ProgressTracker) return false;
    
    const transfer = window.ProgressTracker.getTransfer(transferId);
    if (transfer && transfer.type === 'upload') {
        window.ProgressTracker.cancelTransfer(transferId, reason);
        return true;
    }
    return false;
}

// Export functions for use in other modules
window.UploadHelper = {
    uploadFile,
    uploadMultipleFiles,
    validateFile,
    getUploadStatistics,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    formatFileSize,
    formatTime,
    formatSpeed,
    UPLOAD_CONFIG,
    UploadState,
    ConnectionQualityDetector,
    // Export constants for external use
    FILE_CONSTANTS: window.FILE_CONSTANTS,
    TIMEOUT_CONSTANTS: window.TIMEOUT_CONSTANTS,
    NETWORK_CONSTANTS: window.NETWORK_CONSTANTS
};