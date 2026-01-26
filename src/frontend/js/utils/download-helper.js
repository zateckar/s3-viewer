/**
 * Download Helper Utility
 * Handles file downloads with streaming, resumable support, and progress tracking
 * Enhanced with detailed monitoring and progress tracker integration
 */

/**
 * Download configuration
 */
const DOWNLOAD_CONFIG = {
    // Chunk size for streaming downloads (1MB)
    CHUNK_SIZE: 1024 * 1024,
    // Maximum concurrent downloads
    MAX_CONCURRENT_DOWNLOADS: 3,
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    // Progress update interval (ms)
    PROGRESS_UPDATE_INTERVAL: 500,
    // Timeout for download requests (30 seconds)
    REQUEST_TIMEOUT: 30000,
    // Enable resumable downloads
    ENABLE_RESUMABLE: true,
    // Use streaming endpoint if available
    PREFER_STREAMING: true,
    // Enhanced features
    ENABLE_ADAPTIVE_STREAMING: true,
    ENABLE_INTEGRITY_VERIFICATION: true,
    ENABLE_CONNECTION_QUALITY_DETECTION: true,
    // Adaptive streaming thresholds
    ADAPTIVE_CHUNK: {
        EXCELLENT: { minSpeed: 10 * 1024 * 1024, chunkSize: 5 * 1024 * 1024 }, // 10 MB/s -> 5MB chunks
        GOOD: { minSpeed: 5 * 1024 * 1024, chunkSize: 2 * 1024 * 1024 },     // 5 MB/s -> 2MB chunks
        FAIR: { minSpeed: 1 * 1024 * 1024, chunkSize: 1024 * 1024 },        // 1 MB/s -> 1MB chunks
        POOR: { minSpeed: 0, chunkSize: 512 * 1024 }                        // < 1 MB/s -> 512KB chunks
    },
    // Connection quality monitoring
    CONNECTION_SAMPLE_INTERVAL: 2000, // 2 seconds
    CONNECTION_HISTORY_SIZE: 20
};

/**
 * Connection Quality Monitor for Downloads
 */
class DownloadConnectionMonitor {
    constructor() {
        this.speedHistory = [];
        this.lastUpdate = Date.now();
        this.currentQuality = 'UNKNOWN';
        this.adaptiveChunkSize = DOWNLOAD_CONFIG.CHUNK_SIZE;
    }

    recordSpeed(speed) {
        const now = Date.now();
        this.speedHistory.push({ timestamp: now, speed });
        
        // Keep only recent samples
        const cutoff = now - (DOWNLOAD_CONFIG.CONNECTION_HISTORY_SIZE * DOWNLOAD_CONFIG.CONNECTION_SAMPLE_INTERVAL);
        this.speedHistory = this.speedHistory.filter(sample => sample.timestamp > cutoff);
        
        // Update quality assessment
        this.updateConnectionQuality();
        this.adjustChunkSize();
    }

    updateConnectionQuality() {
        if (this.speedHistory.length === 0) return;
        
        const recentSpeeds = this.speedHistory.slice(-5);
        const averageSpeed = recentSpeeds.reduce((sum, sample) => sum + sample.speed, 0) / recentSpeeds.length;
        
        const thresholds = DOWNLOAD_CONFIG.ADAPTIVE_CHUNK;
        
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
        const thresholds = DOWNLOAD_CONFIG.ADAPTIVE_CHUNK;
        const targetSize = thresholds[this.currentQuality]?.chunkSize || DOWNLOAD_CONFIG.CHUNK_SIZE;
        
        // Gradual adjustment
        const adjustmentFactor = 0.3;
        this.adaptiveChunkSize = Math.round(
            this.adaptiveChunkSize * (1 - adjustmentFactor) + targetSize * adjustmentFactor
        );
        
        // Ensure within bounds
        const minSize = 256 * 1024; // 256KB minimum
        const maxSize = 10 * 1024 * 1024; // 10MB maximum
        this.adaptiveChunkSize = Math.max(minSize, Math.min(maxSize, this.adaptiveChunkSize));
    }

    getConnectionQuality() {
        return this.currentQuality;
    }

    getAdaptiveChunkSize() {
        return this.adaptiveChunkSize;
    }

    getAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        
        const recentSpeeds = this.speedHistory.slice(-10);
        const sum = recentSpeeds.reduce((acc, sample) => acc + sample.speed, 0);
        return sum / recentSpeeds.length;
    }
}

/**
 * Enhanced File download state
 */
class DownloadState {
    constructor(path, fileName, fileSize = 0, transferId = null) {
        this.id = this.generateId();
        this.path = path;
        this.fileName = fileName;
        this.fileSize = fileSize;
        this.status = 'pending'; // pending, downloading, completed, error, paused, cancelled
        this.progress = 0;
        this.bytesDownloaded = 0;
        this.startTime = null;
        this.endTime = null;
        this.speed = 0; // bytes per second
        this.timeRemaining = null;
        this.error = null;
        this.retryCount = 0;
        this.chunkSize = DOWNLOAD_CONFIG.CHUNK_SIZE;
        this.useStreaming = false;
        this.isResumable = false;
        this.lastProgressUpdate = 0;
        this.abortController = null;
        this.downloadUrl = null;
        
        // Enhanced tracking
        this.transferId = transferId || this.generateTransferId('transfer_');
        this.connectionMonitor = new DownloadConnectionMonitor();
        this.integrityHash = null;
        this.verificationStatus = 'pending';
        this.performanceHistory = [];
        this.failureReason = null;
        this.peakSpeed = 0;
        this.averageSpeed = 0;
        this.lastBytesDownloaded = 0;
        this.adaptiveStreamingEnabled = DOWNLOAD_CONFIG.ENABLE_ADAPTIVE_STREAMING;
    }

    generateTransferId(prefix = 'download_') {
        return prefix + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateId() {
        return this.generateTransferId('dl_');
    }

    updateProgress(bytesDownloaded, chunkInfo = null) {
        const previousBytes = this.bytesDownloaded;
        this.bytesDownloaded = bytesDownloaded;
        
        if (this.fileSize > 0) {
            this.progress = Math.min(100, (bytesDownloaded / this.fileSize) * 100);
        }
        
        const now = Date.now();
        if (now - this.lastProgressUpdate >= DOWNLOAD_CONFIG.PROGRESS_UPDATE_INTERVAL) {
            this.lastProgressUpdate = now;
            
            if (this.startTime) {
                const elapsed = (now - this.startTime) / 1000;
                this.speed = elapsed > 0 ? bytesDownloaded / elapsed : 0;
                this.peakSpeed = Math.max(this.peakSpeed, this.speed);
                
                // Update connection monitor
                this.connectionMonitor.recordSpeed(this.speed);
                this.averageSpeed = this.connectionMonitor.getAverageSpeed();
                
                // Adjust chunk size if adaptive streaming is enabled
                if (this.adaptiveStreamingEnabled && this.useStreaming) {
                    this.chunkSize = this.connectionMonitor.getAdaptiveChunkSize();
                }
                
                if (this.speed > 0 && this.fileSize > 0) {
                    const remainingBytes = this.fileSize - bytesDownloaded;
                    this.timeRemaining = remainingBytes / this.speed;
                }
                
                // Record performance sample
                this.performanceHistory.push({
                    timestamp: now,
                    bytesDownloaded,
                    speed: this.speed,
                    averageSpeed: this.averageSpeed,
                    chunkSize: this.chunkSize,
                    connectionQuality: this.connectionMonitor.getConnectionQuality()
                });
                
                // Keep only recent history
                if (this.performanceHistory.length > 60) {
                    this.performanceHistory.shift();
                }
            }
        }
        
        // Notify progress tracker if available
        if (window.ProgressTracker) {
            window.ProgressTracker.updateProgress(this.transferId, bytesDownloaded, this.speed);
        }
    }

    setIntegrityHash(hash) {
        this.integrityHash = hash;
    }

    verifyIntegrity(downloadedData) {
        if (!DOWNLOAD_CONFIG.ENABLE_INTEGRITY_VERIFICATION || !this.integrityHash) {
            this.verificationStatus = 'not_available';
            return true;
        }
        
        // Simple hash verification (in a real implementation, you'd use a proper crypto library)
        const computedHash = this.computeSimpleHash(downloadedData);
        const isValid = computedHash === this.integrityHash;
        
        this.verificationStatus = isValid ? 'verified' : 'failed';
        return isValid;
    }

    computeSimpleHash(data) {
        // Simple hash function for demonstration
        // In production, use proper cryptographic hash functions
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    start(useStreaming = false, metadata = {}) {
        this.status = 'downloading';
        this.startTime = Date.now();
        this.useStreaming = useStreaming;
        this.isResumable = useStreaming && DOWNLOAD_CONFIG.ENABLE_RESUMABLE;
        this.abortController = new AbortController();
        
        // Create transfer in progress tracker
        if (window.ProgressTracker && !window.ProgressTracker.getTransfer(this.transferId)) {
            window.ProgressTracker.createTransfer(
                this.transferId,
                'download',
                this.fileName,
                this.fileSize,
                metadata.priority || window.TRANSFER_PRIORITY?.NORMAL || 2
            );
            
            window.ProgressTracker.startTransfer(this.transferId, {
                path: this.path,
                fileSize: this.fileSize,
                useStreaming: this.useStreaming,
                isResumable: this.isResumable
            });
        }
    }

    pause(reason = '') {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.status = 'paused';
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.pauseTransfer(this.transferId, reason);
        }
    }

    resume() {
        if (this.status === 'paused') {
            this.status = 'downloading';
            this.abortController = new AbortController();
            
            // Update progress tracker
            if (window.ProgressTracker) {
                window.ProgressTracker.resumeTransfer(this.transferId);
            }
            
            return true;
        }
        return false;
    }

    cancel(reason = '') {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.status = 'cancelled';
        this.endTime = Date.now();
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.cancelTransfer(this.transferId, reason);
        }
    }

    complete() {
        this.status = 'completed';
        this.progress = 100;
        if (this.fileSize > 0) {
            this.bytesDownloaded = this.fileSize;
        }
        this.endTime = Date.now();
        this.timeRemaining = 0;
        this.speed = 0;
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.completeTransfer(this.transferId);
        }
    }

    error(message, failureReason = null) {
        this.status = 'error';
        this.error = message;
        this.failureReason = failureReason;
        this.endTime = Date.now();
        
        // Update progress tracker
        if (window.ProgressTracker) {
            window.ProgressTracker.handleTransferError(
                this.transferId,
                message,
                this.retryCount < DOWNLOAD_CONFIG.MAX_RETRIES
            );
        }
    }

    get elapsedSeconds() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return Math.round((endTime - this.startTime) / 1000);
    }

    get isCompleted() {
        return this.status === 'completed';
    }

    get isActive() {
        return ['downloading', 'pending'].includes(this.status);
    }

    get hasError() {
        return this.status === 'error';
    }

    get canResume() {
        return this.status === 'paused' && this.isResumable;
    }

    get canCancel() {
        return ['downloading', 'pending', 'paused'].includes(this.status);
    }

    get connectionQualityStatus() {
        return this.connectionMonitor.getConnectionQuality();
    }

    get currentAdaptiveChunkSize() {
        return this.connectionMonitor.getAdaptiveChunkSize();
    }

    getFailureDetails() {
        return {
            reason: this.failureReason,
            retryCount: this.retryCount,
            lastError: this.error,
            connectionQuality: this.connectionQualityStatus,
            averageSpeed: this.averageSpeed,
            verificationStatus: this.verificationStatus
        };
    }

    getPerformanceMetrics() {
        return {
            peakSpeed: this.peakSpeed,
            averageSpeed: this.averageSpeed,
            connectionQuality: this.connectionQualityStatus,
            adaptiveChunking: this.adaptiveStreamingEnabled,
            verificationStatus: this.verificationStatus,
            performanceHistory: this.performanceHistory.slice(-10) // Last 10 samples
        };
    }
}

/**
 * Download queue manager
 */
class DownloadQueue {
    constructor() {
        this.downloads = new Map();
        this.activeDownloads = [];
        this.maxConcurrent = DOWNLOAD_CONFIG.MAX_CONCURRENT_DOWNLOADS;
        this.progressCallbacks = new Set();
    }

    addDownload(path, fileName, fileSize = 0, transferId = null, bucket = null) {
        const download = new DownloadState(path, fileName, fileSize, transferId);
        download.bucket = bucket;
        this.downloads.set(download.id, download);
        
        // Try to start download if we have capacity
        this.processQueue();
        
        return download.id;
    }

    removeDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.canCancel) {
            download.cancel();
            this.downloads.delete(downloadId);
            this.activeDownloads = this.activeDownloads.filter(id => id !== downloadId);
            return true;
        }
        return false;
    }

    pauseDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.status === 'downloading') {
            download.pause();
            this.activeDownloads = this.activeDownloads.filter(id => id !== downloadId);
            this.processQueue();
            return true;
        }
        return false;
    }

    resumeDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.resume()) {
            this.activeDownloads.push(downloadId);
            return true;
        }
        return false;
    }

    retryDownload(downloadId) {
        const download = this.downloads.get(downloadId);
        if (download && download.hasError) {
            download.status = 'pending';
            download.error = null;
            download.retryCount++;
            this.processQueue();
            return true;
        }
        return false;
    }

    processQueue() {
        // Remove completed downloads from active list
        this.activeDownloads = this.activeDownloads.filter(id => {
            const download = this.downloads.get(id);
            return download && download.isActive;
        });

        // Add pending downloads if we have capacity
        const pendingDownloads = Array.from(this.downloads.values())
            .filter(d => d.status === 'pending')
            .slice(0, this.maxConcurrent - this.activeDownloads.length);

        pendingDownloads.forEach(download => {
            this.activeDownloads.push(download.id);
            // Start download process
            this.startDownload(download);
        });
    }

    async startDownload(download) {
        try {
            // First try to get file info and streaming capability
            const fileInfo = await this.getFileInfo(download.path, download.bucket);
            
            if (fileInfo && fileInfo.size > 0) {
                download.fileSize = fileInfo.size;
            }

            // Determine if we should use streaming
            const useStreaming = DOWNLOAD_CONFIG.PREFER_STREAMING && 
                               fileInfo && fileInfo.supportsStreaming;

            download.start(useStreaming);

            if (useStreaming) {
                await this.downloadStreaming(download);
            } else {
                await this.downloadViaPresignedUrl(download);
            }

            download.complete();
            this.processQueue();
            
        } catch (error) {
            console.error(`Download failed: ${download.fileName}`, error);
            
            // Handle different error types
            let errorMessage = error.message || 'Unknown error occurred';
            let shouldRetry = true;
            
            if (error.message && error.message.includes('File not found')) {
                errorMessage = `File not found: ${download.fileName}`;
                shouldRetry = false; // Don't retry if file doesn't exist
            } else if (error.message && error.message.includes('Access denied')) {
                errorMessage = `Access denied: ${download.fileName}`;
                shouldRetry = false; // Don't retry if access is denied
            } else if (error.message && error.message.includes('Invalid bucket')) {
                errorMessage = `Invalid bucket for download`;
                shouldRetry = false;
            }
            
            download.error(errorMessage, determineDownloadFailureReason(error, download));
            
            // Retry logic only for retryable errors
            if (shouldRetry && download.retryCount < DOWNLOAD_CONFIG.MAX_RETRIES) {
                setTimeout(() => {
                    this.retryDownload(download.id);
                }, DOWNLOAD_CONFIG.RETRY_DELAY * (download.retryCount + 1));
            }
            
            this.processQueue();
        }
    }

    async getFileInfo(path, bucket = null) {
        try {
            const encodedPath = encodeURIComponent(path.replace(/^\/+/, ''));
            let url = `/api/v1/files/info?path=${encodedPath}`;
            
            if (bucket) {
                url += `&bucket=${encodeURIComponent(bucket)}`;
            }
            
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return data.data;
                }
            }
        } catch (error) {
            console.warn('Could not get file info:', error);
        }
        return null;
    }

    async downloadStreaming(download) {
        const encodedPath = encodeURIComponent(download.path.replace(/^\/+/, ''));
        let url = `/api/v1/files/stream?path=${encodedPath}`;
        
        if (download.bucket) {
            url += `&bucket=${encodeURIComponent(download.bucket)}`;
        }
        
        // Calculate byte range
        let startByte = download.bytesDownloaded;
        let endByte = startByte + download.chunkSize - 1;
        
        // Stream the file in chunks
        while (download.status === 'downloading' && (!download.fileSize || startByte < download.fileSize)) {
            const headers = {
                'Range': `bytes=${startByte}-${download.fileSize ? Math.min(endByte, download.fileSize - 1) : endByte}`
            };

            const response = await fetch(url, {
                headers,
                signal: download.abortController?.signal
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;
                download.updateProgress(download.bytesDownloaded + receivedLength);
                
                // Notify progress callbacks
                this.notifyProgressCallbacks(download);
            }

            // Process received chunk
            const chunk = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunkArray of chunks) {
                chunk.set(chunkArray, position);
                position += chunkArray.length;
            }

            // For streaming downloads, we need to handle the blob creation
            // This is a simplified version - in production, you might want to
            // stream directly to a file or handle larger files differently
            if (!download.downloadBlob) {
                download.downloadBlob = [];
            }
            download.downloadBlob.push(chunk);

            // Update progress
            download.bytesDownloaded += receivedLength;
            
            // Prepare for next chunk
            startByte = endByte + 1;
            endByte = startByte + download.chunkSize - 1;
        }

        // Create final blob and trigger download
        if (download.downloadBlob && download.downloadBlob.length > 0) {
            const finalBlob = new Blob(download.downloadBlob);
            await this.saveFile(finalBlob, download.fileName);
        }
    }

    async downloadViaPresignedUrl(download) {
        // Use backend streaming endpoint instead of presigned URLs to avoid CORS issues
        const encodedPath = encodeURIComponent(download.path.replace(/^\/+/, ''));
        let url = `/api/v1/files/stream?path=${encodedPath}`;
        
        if (download.bucket) {
            url += `&bucket=${encodeURIComponent(download.bucket)}`;
        }

        // Download using XMLHttpRequest for progress tracking
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    download.updateProgress(event.loaded);
                    this.notifyProgressCallbacks(download);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Save the file
                    const blob = new Blob([xhr.response]);
                    this.saveFile(blob, download.fileName);
                    resolve();
                } else {
                    reject(new Error(`Download failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error during download'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Download was cancelled'));
            });

            xhr.open('GET', url);
            xhr.responseType = 'blob';
            xhr.send();
        });
    }

    async saveFile(blob, fileName) {
        // Create download link and trigger download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the object URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    addProgressCallback(callback) {
        this.progressCallbacks.add(callback);
    }

    removeProgressCallback(callback) {
        this.progressCallbacks.delete(callback);
    }

    notifyProgressCallbacks(download) {
        this.progressCallbacks.forEach(callback => {
            try {
                callback(download);
            } catch (error) {
                console.error('Progress callback error:', error);
            }
        });
    }

    getActiveDownloads() {
        return Array.from(this.downloads.values()).filter(d => d.isActive);
    }

    getCompletedDownloads() {
        return Array.from(this.downloads.values()).filter(d => d.isCompleted);
    }

    getFailedDownloads() {
        return Array.from(this.downloads.values()).filter(d => d.hasError);
    }

    clearCompleted() {
        const completedIds = Array.from(this.downloads.values())
            .filter(d => d.isCompleted)
            .map(d => d.id);
        
        completedIds.forEach(id => this.downloads.delete(id));
    }

    clearFailed() {
        const failedIds = Array.from(this.downloads.values())
            .filter(d => d.hasError)
            .map(d => d.id);
        
        failedIds.forEach(id => this.downloads.delete(id));
    }
}

// Global download queue instance
const downloadQueue = new DownloadQueue();

/**
 * Public download function
 * @param {string} path - File path in S3
 * @param {function} onProgress - Progress callback function
 * @param {Object} options - Download options
 * @returns {Promise<string>} Download ID
 */
async function downloadFile(path, onProgress, bucket = null, options = {}) {
    // Handle parameter overloads
    if (typeof bucket === 'object' && bucket !== null && options === undefined) {
        // Handle cases where bucket might be passed as options
        options = bucket;
        bucket = options.bucket || (window.fileBrowserApp ? window.fileBrowserApp.currentBucket : null);
    }
    
    // Extract bucket from the current app state if not provided
    if (!bucket && window.fileBrowserApp) {
        bucket = window.fileBrowserApp.currentBucket;
    }
    
    const fileName = options.fileName || path.split('/').pop() || 'download';
    const fileSize = options.fileSize || 0;
    
    const downloadId = downloadQueue.addDownload(path, fileName, fileSize, null, bucket);
    
    if (onProgress) {
        downloadQueue.addProgressCallback((download) => {
            if (download.id === downloadId) {
                onProgress(download);
            }
        });
    }
    
    return downloadId;
}

/**
 * Download management functions
 */
function pauseDownload(downloadId) {
    return downloadQueue.pauseDownload(downloadId);
}

function resumeDownload(downloadId) {
    return downloadQueue.resumeDownload(downloadId);
}

function cancelDownload(downloadId) {
    return downloadQueue.removeDownload(downloadId);
}

function retryDownload(downloadId) {
    return downloadQueue.retryDownload(downloadId);
}

/**
 * Utility functions
 */
function formatFileSize(bytes) {
    if (bytes === 0 || !bytes) return '—';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

function formatSpeed(bytesPerSecond) {
    if (!bytesPerSecond) return '—';
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * Get download statistics and analytics
 * @param {string} transferId - Optional transfer ID to get specific stats
 * @returns {Object} Download statistics
 */
function getDownloadStatistics(transferId = null) {
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

    // Return overall download statistics
    const downloadTransfers = window.ProgressTracker.getTransfersByType('download');
    const completedDownloads = downloadTransfers.filter(t => t.status === 'completed');
    const activeDownloads = downloadTransfers.filter(t => t.status === 'active');
    const failedDownloads = downloadTransfers.filter(t => t.status === 'error');

    return {
        total: downloadTransfers.length,
        completed: completedDownloads.length,
        active: activeDownloads.length,
        failed: failedDownloads.length,
        totalBytes: downloadTransfers.reduce((sum, t) => sum + t.totalBytes, 0),
        totalBytesTransferred: downloadTransfers.reduce((sum, t) => sum + t.transferredBytes, 0),
        averageSpeed: completedDownloads.length > 0
            ? completedDownloads.reduce((sum, t) => sum + t.stats.averageSpeed, 0) / completedDownloads.length
            : 0,
        peakSpeed: Math.max(...downloadTransfers.map(t => t.stats.peakSpeed || 0)),
        recentTransfers: downloadTransfers.slice(-10)
    };
}

/**
 * Determine download failure reason for better error tracking
 * @param {Error} error - The error that occurred
 * @param {DownloadState} downloadState - Current download state
 * @returns {string} Categorized failure reason
 */
function determineDownloadFailureReason(error, downloadState) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        return 'NETWORK_ERROR';
    } else if (errorMessage.includes('timeout')) {
        return 'TIMEOUT';
    } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        return 'FILE_NOT_FOUND';
    } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        return 'PERMISSION_DENIED';
    } else if (errorMessage.includes('size') || errorMessage.includes('large')) {
        return 'FILE_TOO_LARGE';
    } else if (errorMessage.includes('integrity') || errorMessage.includes('corrupt')) {
        return 'INTEGRITY_CHECK_FAILED';
    } else if (downloadState.connectionQualityStatus === 'POOR') {
        return 'POOR_CONNECTION';
    } else {
        return 'UNKNOWN_ERROR';
    }
}

/**
 * Batch download multiple files with enhanced tracking
 * @param {Array} files - Array of file objects { path, fileName, fileSize }
 * @param {function} onProgress - Progress callback function
 * @param {Object} options - Download options
 * @returns {Promise<Array>} Download results
 */
async function downloadMultipleFiles(files, onProgress, options = {}) {
    const results = [];
    const totalFiles = files.length;
    let completedFiles = 0;
    let totalBytes = 0;
    let totalBytesProcessed = 0;

    // Calculate total size
    for (const file of files) {
        totalBytes += file.fileSize || 0;
    }

    // Create batch transfer ID
    const batchId = 'batch_dl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // Process files with concurrency control
    const maxConcurrent = options.maxConcurrent || DOWNLOAD_CONFIG.MAX_CONCURRENT_DOWNLOADS;
    let activeCount = 0;
    
    const downloadPromises = files.map(async (file, index) => {
        // Wait for available slot
        while (activeCount >= maxConcurrent) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        activeCount++;
        
        try {
            const downloadId = await downloadFile(file.path, (downloadState) => {
                // Update total progress
                const bytesDiff = downloadState.bytesDownloaded - (downloadState.lastBytesDownloaded || 0);
                totalBytesProcessed += bytesDiff;
                downloadState.lastBytesDownloaded = downloadState.bytesDownloaded;
                
                const overallProgress = totalBytes > 0 ? (totalBytesProcessed / totalBytes) * 100 : 0;
                
                if (onProgress) {
                    onProgress({
                        type: 'batch',
                        batchId,
                        totalFiles,
                        completedFiles: completedFiles + (downloadState.isCompleted ? 1 : 0),
                        totalBytes,
                        totalBytesProcessed,
                        overallProgress,
                        currentFile: downloadState,
                        fileIndex: index
                    });
                }
            }, { ...options, batchId, transferId: file.transferId });

            // Wait for completion to get final state
            let downloadState = downloadQueue.getDownload(downloadId);
            while (!downloadState?.isCompleted && !downloadState?.hasError) {
                await new Promise(resolve => setTimeout(resolve, 500));
                downloadState = downloadQueue.getDownload(downloadId);
            }

            completedFiles++;
            results.push({
                success: downloadState?.isCompleted || false,
                file: file.fileName,
                downloadId,
                transferId: downloadState?.transferId
            });

        } catch (error) {
            completedFiles++;
            results.push({
                success: false,
                file: file.fileName,
                error: error.message,
                transferId: null
            });
        } finally {
            activeCount--;
        }
    });

    await Promise.all(downloadPromises);
    return results;
}

/**
 * Get global download queue instance
 */
function getDownloadQueue() {
    return downloadQueue;
}

/**
 * Get download by transfer ID
 * @param {string} transferId - Transfer ID to find
 * @returns {DownloadState|null} Download state or null
 */
function getDownloadByTransferId(transferId) {
    for (const download of downloadQueue.downloads.values()) {
        if (download.transferId === transferId) {
            return download;
        }
    }
    return null;
}

// Export functions for use in other modules
window.DownloadHelper = {
    downloadFile,
    downloadMultipleFiles,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    getDownloadStatistics,
    getDownloadQueue,
    getDownloadByTransferId,
    determineDownloadFailureReason,
    formatFileSize,
    formatTime,
    formatSpeed,
    DOWNLOAD_CONFIG,
    DownloadState,
    DownloadConnectionMonitor
};