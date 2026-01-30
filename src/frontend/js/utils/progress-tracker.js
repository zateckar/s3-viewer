/**
 * Progress Tracker Utility
 * Centralized progress management for uploads and downloads with detailed statistics
 */

/**
 * Progress Tracker Configuration
 */
const PROGRESS_CONFIG = {
    // Update interval for real-time statistics (ms)
    UPDATE_INTERVAL: 500,
    // History retention period (ms) - 7 days
    HISTORY_RETENTION: 7 * 24 * 60 * 60 * 1000,
    // Maximum history entries per operation
    MAX_HISTORY_ENTRIES: 100,
    // Storage key for persistence
    STORAGE_KEY: 's3-progress-data',
    // Network quality check interval (ms)
    NETWORK_CHECK_INTERVAL: 10000,
    // Speed sample window for calculating average speed
    SPEED_SAMPLE_WINDOW: 10000, // 10 seconds
};

/**
 * Network Quality Classifiers
 */
const NETWORK_QUALITY = {
    EXCELLENT: { minSpeed: 10 * 1024 * 1024, label: 'Excellent', color: '#27ae60' },    // 10+ MB/s
    GOOD: { minSpeed: 5 * 1024 * 1024, label: 'Good', color: '#3498db' },              // 5-10 MB/s
    FAIR: { minSpeed: 1 * 1024 * 1024, label: 'Fair', color: '#f39c12' },              // 1-5 MB/s
    POOR: { minSpeed: 0, label: 'Poor', color: '#e74c3c' }                           // < 1 MB/s
};

/**
 * Transfer Priority Levels
 */
const TRANSFER_PRIORITY = {
    HIGH: 3,
    NORMAL: 2,
    LOW: 1
};

/**
 * Progress Entry for historical tracking
 */
class ProgressEntry {
    constructor(timestamp, bytes, speed) {
        this.timestamp = timestamp;
        this.bytes = bytes;
        this.speed = speed;
    }
}

/**
 * Transfer Statistics
 */
class TransferStats {
    constructor() {
        this.reset();
    }

    reset() {
        this.startTime = null;
        this.endTime = null;
        this.totalBytes = 0;
        this.transferredBytes = 0;
        this.currentSpeed = 0;
        this.averageSpeed = 0;
        this.peakSpeed = 0;
        this.speedHistory = [];
        this.progressHistory = [];
        this.timeVariations = [];
        this.errors = [];
        this.retryCount = 0;
        this.pauseCount = 0;
        this.resumeCount = 0;
    }

    addSpeedSample(timestamp, speed) {
        this.speedHistory.push({ timestamp, speed });
        
        // Keep only recent samples within the sample window
        const cutoff = timestamp - PROGRESS_CONFIG.SPEED_SAMPLE_WINDOW;
        this.speedHistory = this.speedHistory.filter(sample => sample.timestamp > cutoff);
        
        // Update current and average speed
        this.currentSpeed = speed;
        if (this.speedHistory.length > 0) {
            const sum = this.speedHistory.reduce((acc, sample) => acc + sample.speed, 0);
            this.averageSpeed = sum / this.speedHistory.length;
        }
        
        // Update peak speed
        this.peakSpeed = Math.max(this.peakSpeed, speed);
    }

    addProgressEntry(timestamp, bytes) {
        this.progressHistory.push(new ProgressEntry(timestamp, bytes, this.currentSpeed));
        
        // Limit history size
        if (this.progressHistory.length > PROGRESS_CONFIG.MAX_HISTORY_ENTRIES) {
            this.progressHistory.shift();
        }
    }

    addError(timestamp, error) {
        this.errors.push({ timestamp, error });
    }

    getTimeVariations() {
        if (this.progressHistory.length < 2) return [];
        
        const variations = [];
        for (let i = 1; i < this.progressHistory.length; i++) {
            const current = this.progressHistory[i];
            const previous = this.progressHistory[i - 1];
            const timeDiff = current.timestamp - previous.timestamp;
            const byteDiff = current.bytes - previous.bytes;
            const speed = timeDiff > 0 ? byteDiff / timeDiff : 0;
            
            variations.push({
                timestamp: current.timestamp,
                timeDiff,
                byteDiff,
                speed
            });
        }
        
        return variations;
    }

    getProgressPercentage() {
        return this.totalBytes > 0 ? (this.transferredBytes / this.totalBytes) * 100 : 0;
    }

    getTimeElapsed() {
        if (!this.startTime) return 0;
        const endTime = this.endTime || Date.now();
        return endTime - this.startTime;
    }

    getTimeRemaining() {
        if (this.currentSpeed <= 0) return null;
        const remainingBytes = this.totalBytes - this.transferredBytes;
        return remainingBytes / this.currentSpeed;
    }

    getEstimatedCompletionTime() {
        if (!this.startTime) return null;
        const timeRemaining = this.getTimeRemaining();
        if (timeRemaining === null) return null;
        return Date.now() + (timeRemaining * 1000);
    }
}

/**
 * Main Progress Tracker Class
 */
class ProgressTracker {
    constructor() {
        this.transfers = new Map(); // All active and historical transfers
        this.activeTransfers = new Map(); // Currently active transfers
        this.transferQueue = []; // Queue for managing transfer priority
        this.globalStats = {
            totalUploads: 0,
            totalDownloads: 0,
            totalBytesTransferred: 0,
            totalErrors: 0,
            averageUploadSpeed: 0,
            averageDownloadSpeed: 0,
            networkQuality: 'UNKNOWN'
        };
        this.callbacks = new Set();
        this.updateTimer = null;
        this.networkCheckTimer = null;
        
        this.loadPersistedData();
        this.startUpdateTimer();
        this.startNetworkQualityCheck();
    }

    /**
     * Create a new transfer entry
     */
    createTransfer(id, type, fileName, totalBytes, priority = TRANSFER_PRIORITY.NORMAL) {
        const transfer = {
            id,
            type, // 'upload' or 'download'
            fileName,
            totalBytes,
            transferredBytes: 0,
            status: 'pending', // pending, active, paused, completed, error, cancelled
            priority,
            startTime: null,
            endTime: null,
            stats: new TransferStats(),
            metadata: {},
            persistentId: this.generatePersistentId()
        };
        
        transfer.stats.totalBytes = totalBytes;
        
        // Add computed property for percentage
        Object.defineProperty(transfer, 'percentage', {
            get() {
                return this.totalBytes > 0 ? (this.transferredBytes / this.totalBytes) * 100 : 0;
            }
        });
        
        // Add computed property for currentSpeed
        Object.defineProperty(transfer, 'currentSpeed', {
            get() {
                return this.stats.currentSpeed || 0;
            }
        });
        
        this.transfers.set(id, transfer);
        this.persistData();
        
        return transfer;
    }

    /**
     * Start tracking a transfer
     */
    startTransfer(id, metadata = {}) {
        const transfer = this.transfers.get(id);
        if (!transfer) return null;
        
        transfer.status = 'active';
        transfer.startTime = Date.now();
        transfer.stats.startTime = transfer.startTime;
        transfer.metadata = { ...transfer.metadata, ...metadata };
        
        this.activeTransfers.set(id, transfer);
        this.updateGlobalStats();
        this.notifyCallbacks('transferStarted', transfer);
        this.persistData();
        
        return transfer;
    }

    /**
     * Update transfer progress
     */
    updateProgress(id, transferredBytes, speed = 0) {
        const transfer = this.transfers.get(id);
        if (!transfer) return null;
        
        const now = Date.now();
        const previousBytes = transfer.transferredBytes;
        
        transfer.transferredBytes = Math.min(transferredBytes, transfer.totalBytes);
        transfer.stats.transferredBytes = transfer.transferredBytes;
        
        if (speed > 0) {
            transfer.stats.addSpeedSample(now, speed);
        }
        
        transfer.stats.addProgressEntry(now, transfer.transferredBytes);
        
        // Debug logging for percentage calculation
        if (transfer.transferredBytes % (1024 * 1024) === 0 || transfer.transferredBytes === transfer.totalBytes) {
            console.log('🔍 DEBUG: Transfer progress:', {
                id: transfer.id,
                fileName: transfer.fileName,
                transferredBytes: transfer.transferredBytes,
                totalBytes: transfer.totalBytes,
                percentage: transfer.percentage,
                percentageCalculated: (transfer.transferredBytes / transfer.totalBytes) * 100
            });
        }
        
        // Check if completed
        if (transfer.transferredBytes >= transfer.totalBytes) {
            this.completeTransfer(id);
        }
        
        this.updateGlobalStats();
        this.notifyCallbacks('progressUpdated', transfer);
        
        return transfer;
    }

    /**
     * Pause a transfer
     */
    pauseTransfer(id, reason = '') {
        const transfer = this.transfers.get(id);
        if (!transfer || transfer.status !== 'active') return null;
        
        transfer.status = 'paused';
        transfer.stats.pauseCount++;
        
        this.activeTransfers.delete(id);
        this.notifyCallbacks('transferPaused', { transfer, reason });
        this.persistData();
        
        return transfer;
    }

    /**
     * Resume a transfer
     */
    resumeTransfer(id) {
        const transfer = this.transfers.get(id);
        if (!transfer || transfer.status !== 'paused') return null;
        
        transfer.status = 'active';
        transfer.stats.resumeCount++;
        
        this.activeTransfers.set(id, transfer);
        this.updateGlobalStats();
        this.notifyCallbacks('transferResumed', transfer);
        this.persistData();
        
        return transfer;
    }

    /**
     * Complete a transfer
     */
    completeTransfer(id) {
        const transfer = this.transfers.get(id);
        if (!transfer) return null;
        
        transfer.status = 'completed';
        transfer.endTime = Date.now();
        transfer.stats.endTime = transfer.endTime;
        transfer.transferredBytes = transfer.totalBytes;
        transfer.stats.transferredBytes = transfer.totalBytes;
        
        this.activeTransfers.delete(id);
        
        // Update global stats
        if (transfer.type === 'upload') {
            this.globalStats.totalUploads++;
        } else {
            this.globalStats.totalDownloads++;
        }
        this.globalStats.totalBytesTransferred += transfer.totalBytes;
        
        this.updateGlobalStats();
        this.notifyCallbacks('transferCompleted', transfer);
        this.persistData();
        
        return transfer;
    }

    /**
     * Handle transfer error
     */
    handleTransferError(id, error, retryable = true) {
        const transfer = this.transfers.get(id);
        if (!transfer) return null;
        
        const now = Date.now();
        transfer.status = 'error';
        transfer.endTime = now;
        transfer.stats.endTime = now;
        transfer.stats.addError(now, error);
        transfer.stats.retryCount++;
        
        this.activeTransfers.delete(id);
        this.globalStats.totalErrors++;
        
        this.updateGlobalStats();
        this.notifyCallbacks('transferError', { transfer, error, retryable });
        this.persistData();
        
        return transfer;
    }

    /**
     * Cancel a transfer
     */
    cancelTransfer(id, reason = '') {
        const transfer = this.transfers.get(id);
        if (!transfer) return null;
        
        transfer.status = 'cancelled';
        transfer.endTime = Date.now();
        transfer.stats.endTime = transfer.endTime;
        
        this.activeTransfers.delete(id);
        this.notifyCallbacks('transferCancelled', { transfer, reason });
        this.persistData();
        
        return transfer;
    }

    /**
     * Get transfer by ID
     */
    getTransfer(id) {
        return this.transfers.get(id);
    }

    /**
     * Get active transfers
     */
    getActiveTransfers() {
        return Array.from(this.activeTransfers.values());
    }

    /**
     * Get transfers by type (upload/download)
     */
    getTransfersByType(type) {
        return Array.from(this.transfers.values()).filter(t => t.type === type);
    }

    /**
     * Get transfers filtered by status
     */
    getTransfersByStatus(status) {
        return Array.from(this.transfers.values()).filter(t => t.status === status);
    }

    /**
     * Get transfer history
     */
    getTransferHistory(limit = 50) {
        return Array.from(this.transfers.values())
            .filter(t => ['completed', 'error', 'cancelled'].includes(t.status))
            .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
            .slice(0, limit);
    }

    /**
     * Get bandwidth usage statistics
     */
    getBandwidthUsage() {
        const activeUploads = this.getActiveTransfers().filter(t => t.type === 'upload');
        const activeDownloads = this.getActiveTransfers().filter(t => t.type === 'download');
        
        const uploadSpeed = activeUploads.reduce((sum, t) => sum + t.stats.currentSpeed, 0);
        const downloadSpeed = activeDownloads.reduce((sum, t) => sum + t.stats.currentSpeed, 0);
        const totalSpeed = uploadSpeed + downloadSpeed;
        
        return {
            uploadSpeed,
            downloadSpeed,
            totalSpeed,
            activeUploads: activeUploads.length,
            activeDownloads: activeDownloads.length,
            totalActive: this.activeTransfers.size
        };
    }

    /**
     * Get network quality assessment
     */
    getNetworkQuality() {
        const bandwidth = this.getBandwidthUsage();
        const totalSpeed = bandwidth.totalSpeed;
        
        for (const [quality, config] of Object.entries(NETWORK_QUALITY)) {
            if (totalSpeed >= config.minSpeed) {
                return {
                    quality,
                    label: config.label,
                    color: config.color,
                    speed: totalSpeed
                };
            }
        }
        
        return {
            quality: 'POOR',
            label: 'Poor',
            color: NETWORK_QUALITY.POOR.color,
            speed: totalSpeed
        };
    }

    /**
     * Update global statistics
     */
    updateGlobalStats() {
        const completedUploads = this.getTransfersByType('upload').filter(t => t.status === 'completed');
        const completedDownloads = this.getTransfersByType('download').filter(t => t.status === 'completed');
        
        if (completedUploads.length > 0) {
            const totalUploadSpeed = completedUploads.reduce((sum, t) => sum + t.stats.averageSpeed, 0);
            this.globalStats.averageUploadSpeed = totalUploadSpeed / completedUploads.length;
        }
        
        if (completedDownloads.length > 0) {
            const totalDownloadSpeed = completedDownloads.reduce((sum, t) => sum + t.stats.averageSpeed, 0);
            this.globalStats.averageDownloadSpeed = totalDownloadSpeed / completedDownloads.length;
        }
        
        this.globalStats.networkQuality = this.getNetworkQuality().quality;
    }

    /**
     * Add progress callback
     */
    addProgressCallback(callback) {
        this.callbacks.add(callback);
    }

    /**
     * Remove progress callback
     */
    removeProgressCallback(callback) {
        this.callbacks.delete(callback);
    }

    /**
     * Notify all callbacks
     */
    notifyCallbacks(event, data) {
        this.callbacks.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Progress tracker callback error:', error);
            }
        });
    }

    /**
     * Start automatic update timer
     */
    startUpdateTimer() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        this.updateTimer = setInterval(() => {
            this.updateGlobalStats();
            this.notifyCallbacks('statsUpdated', this.globalStats);
        }, PROGRESS_CONFIG.UPDATE_INTERVAL);
    }

    /**
     * Start network quality check
     */
    startNetworkQualityCheck() {
        if (this.networkCheckTimer) {
            clearInterval(this.networkCheckTimer);
        }
        
        this.networkCheckTimer = setInterval(() => {
            const quality = this.getNetworkQuality();
            if (quality.quality !== this.globalStats.networkQuality) {
                this.globalStats.networkQuality = quality.quality;
                this.notifyCallbacks('networkQualityChanged', quality);
            }
        }, PROGRESS_CONFIG.NETWORK_CHECK_INTERVAL);
    }

    /**
     * Generate persistent ID
     */
    generatePersistentId() {
        return 'transfer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Clean old history data
     */
    cleanupHistory() {
        const cutoff = Date.now() - PROGRESS_CONFIG.HISTORY_RETENTION;
        let cleaned = 0;
        
        for (const [id, transfer] of this.transfers) {
            const endTime = transfer.endTime || transfer.startTime || 0;
            if (endTime < cutoff && ['completed', 'error', 'cancelled'].includes(transfer.status)) {
                this.transfers.delete(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.persistData();
        }
        
        return cleaned;
    }

    /**
     * Persist data to localStorage
     */
    persistData() {
        try {
            const data = {
                transfers: Array.from(this.transfers.entries()).map(([id, transfer]) => [
                    id,
                    {
                        ...transfer,
                        stats: {
                            ...transfer.stats,
                            speedHistory: transfer.stats.speedHistory.slice(-50), // Limit stored history
                            progressHistory: transfer.stats.progressHistory.slice(-50)
                        }
                    }
                ]),
                globalStats: this.globalStats,
                timestamp: Date.now()
            };
            
            localStorage.setItem(PROGRESS_CONFIG.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to persist progress data:', error);
        }
    }

    /**
     * Load persisted data from localStorage
     */
    loadPersistedData() {
        try {
            const stored = localStorage.getItem(PROGRESS_CONFIG.STORAGE_KEY);
            if (!stored) return;
            
            const data = JSON.parse(stored);
            
            // Restore transfers
            if (data.transfers) {
                data.transfers.forEach(([id, transferData]) => {
                    const transfer = {
                        ...transferData,
                        stats: Object.assign(new TransferStats(), transferData.stats)
                    };
                    
                    // Don't restore active transfers as they were interrupted
                    if (transfer.status === 'active') {
                        transfer.status = 'error';
                        transfer.endTime = transferData.startTime || Date.now();
                        transfer.stats.addError(Date.now(), 'Transfer interrupted by page reload');
                    }
                    
                    this.transfers.set(id, transfer);
                });
            }
            
            // Restore global stats
            if (data.globalStats) {
                this.globalStats = { ...this.globalStats, ...data.globalStats };
            }
            
            // Clean old data
            this.cleanupHistory();
        } catch (error) {
            console.warn('Failed to load persisted progress data:', error);
        }
    }

    /**
     * Get global statistics
     */
    getGlobalStatistics() {
        return {
            ...this.globalStats,
            activeTransferCount: this.activeTransfers.size,
            totalBandwidthUsage: this.getBandwidthUsage().totalSpeed,
            networkQuality: this.getNetworkQuality().quality
        };
    }

    /**
     * Pause all active transfers
     */
    pauseAllTransfers() {
        const activeTransfers = Array.from(this.activeTransfers.values());
        activeTransfers.forEach(transfer => {
            this.pauseTransfer(transfer.id, 'Paused by user');
        });
        return activeTransfers.length;
    }

    /**
     * Resume all paused transfers
     */
    resumeAllTransfers() {
        const pausedTransfers = Array.from(this.transfers.values())
            .filter(t => t.status === 'paused');
        
        pausedTransfers.forEach(transfer => {
            this.resumeTransfer(transfer.id);
        });
        
        return pausedTransfers.length;
    }

    /**
     * Cancel all active transfers
     */
    cancelAllTransfers() {
        const activeTransfers = Array.from(this.activeTransfers.values());
        activeTransfers.forEach(transfer => {
            this.cancelTransfer(transfer.id, 'Cancelled by user');
        });
        return activeTransfers.length;
    }

    /**
     * Destroy the progress tracker
     */
    destroy() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        if (this.networkCheckTimer) {
            clearInterval(this.networkCheckTimer);
        }
        
        this.persistData();
    }
}

// Create global instance
const progressTracker = new ProgressTracker();

// Export
window.ProgressTracker = progressTracker;
window.TransferStats = TransferStats;
window.TRANSFER_PRIORITY = TRANSFER_PRIORITY;
window.NETWORK_QUALITY = NETWORK_QUALITY;
window.PROGRESS_CONFIG = PROGRESS_CONFIG;