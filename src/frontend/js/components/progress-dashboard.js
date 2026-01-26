/**
 * Progress Dashboard Component
 * Unified Alpine.js component for monitoring transfer statistics
 */

function progressDashboard() {
    return {
        isOpen: false,
        bandwidthUsage: {
            uploadSpeed: 0,
            downloadSpeed: 0,
            totalSpeed: 0,
            activeUploads: 0,
            activeDownloads: 0,
            totalActive: 0
        },
        networkQuality: {
            quality: 'UNKNOWN',
            label: 'Unknown',
            color: '#95a5a6',
            speed: 0
        },
        globalStats: {
            totalUploads: 0,
            totalDownloads: 0,
            totalBytesTransferred: 0,
            totalErrors: 0,
            averageUploadSpeed: 0,
            averageDownloadSpeed: 0
        },
        activeTransfers: [],
        transferHistory: [],
        // Computed properties for HTML bindings
        recentTransfers: [],
        completedTodayCount: 0,
        totalBytesTransferred: 0,
        averageSpeed: 0,
        transferPriorities: {
            HIGH: 3,
            NORMAL: 2,
            LOW: 1
        },
        priorityLabels: {
            1: 'Low',
            2: 'Normal', 
            3: 'High'
        },
        isMinimized: false,
        autoRefreshEnabled: true,
        refreshInterval: 2000, // 2 seconds
        refreshTimer: null,

        init() {
            // Initialize progress tracker callbacks
            if (window.ProgressTracker) {
                window.ProgressTracker.addProgressCallback(this.handleProgressEvent.bind(this));
                this.updateDashboard();
                this.startAutoRefresh();
            }

            // Start bandwidth monitoring
            this.startBandwidthMonitoring();
        },

        /**
         * Toggle dashboard visibility
         */
        toggle() {
            this.isOpen = !this.isOpen;
            if (this.isOpen) {
                this.updateDashboard();
            }
        },

        /**
         * Toggle minimized state
         */
        toggleMinimized() {
            this.isMinimized = !this.isMinimized;
        },

        /**
         * Handle progress events from tracker
         */
        handleProgressEvent(event, data) {
            switch (event) {
                case 'transferStarted':
                case 'progressUpdated':
                case 'transferCompleted':
                case 'transferError':
                case 'statsUpdated':
                case 'networkQualityChanged':
                    if (this.autoRefreshEnabled) {
                        this.updateDashboard();
                    }
                    break;
            }
        },

        /**
         * Update dashboard data
         */
        updateDashboard() {
            if (!window.ProgressTracker) return;

            // Update bandwidth usage
            this.bandwidthUsage = window.ProgressTracker.getBandwidthUsage();
            
            // Update network quality
            this.networkQuality = window.ProgressTracker.getNetworkQuality();
            
            // Update global stats
            this.globalStats = { ...window.ProgressTracker.globalStats };
            
            // Update active transfers
            this.activeTransfers = window.ProgressTracker.getActiveTransfers()
                .sort((a, b) => b.priority - a.priority);
            
            // Update transfer history
            this.transferHistory = window.ProgressTracker.getTransferHistory(20);
            
            // Update computed properties for HTML bindings
            this.recentTransfers = this.transferHistory;
            this.totalBytesTransferred = this.globalStats.totalBytesTransferred || 0;
            this.averageSpeed = (this.globalStats.averageUploadSpeed || 0) + (this.globalStats.averageDownloadSpeed || 0);
            
            // Calculate completed today count
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.completedTodayCount = this.transferHistory.filter(t => {
                if (t.status !== 'completed' || !t.endTime) return false;
                const transferDate = new Date(t.endTime);
                return transferDate >= today;
            }).length;
        },

        /**
         * Start automatic refresh
         */
        startAutoRefresh() {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
            }
            
            this.refreshTimer = setInterval(() => {
                if (this.isOpen && this.autoRefreshEnabled) {
                    this.updateDashboard();
                }
            }, this.refreshInterval);
        },

        /**
         * Stop automatic refresh
         */
        stopAutoRefresh() {
            if (this.refreshTimer) {
                clearInterval(this.refreshTimer);
                this.refreshTimer = null;
            }
        },

        /**
         * Start bandwidth monitoring
         */
        startBandwidthMonitoring() {
            setInterval(() => {
                if (window.ProgressTracker && this.isOpen) {
                    this.bandwidthUsage = window.ProgressTracker.getBandwidthUsage();
                }
            }, 1000);
        },

        /**
         * Pause all transfers
         */
        pauseAll() {
            if (!window.ProgressTracker) return;
            
            this.activeTransfers.forEach(transfer => {
                window.ProgressTracker.pauseTransfer(transfer.id, 'Paused by user');
            });
            
            this.showNotification('All transfers paused', 'info');
        },

        /**
         * Resume all transfers
         */
        resumeAll() {
            if (!window.ProgressTracker) return;
            
            const pausedTransfers = window.ProgressTracker.getTransfersByStatus('paused');
            pausedTransfers.forEach(transfer => {
                window.ProgressTracker.resumeTransfer(transfer.id);
            });
            
            this.showNotification('All paused transfers resumed', 'info');
        },

        /**
         * Cancel all transfers
         */
        cancelAll() {
            if (!confirm('Are you sure you want to cancel all active transfers?')) {
                return;
            }
            
            if (!window.ProgressTracker) return;
            
            this.activeTransfers.forEach(transfer => {
                window.ProgressTracker.cancelTransfer(transfer.id, 'Cancelled by user');
            });
            
            this.showNotification('All transfers cancelled', 'warning');
        },

        /**
         * Change transfer priority
         */
        changePriority(transferId, newPriority) {
            if (!window.ProgressTracker) return;
            
            const transfer = window.ProgressTracker.getTransfer(transferId);
            if (transfer) {
                transfer.priority = this.transferPriorities[newPriority.toUpperCase()];
                this.showNotification(`Transfer priority changed to ${newPriority}`, 'info');
            }
        },

        /**
         * Get priority color
         */
        getPriorityColor(priority) {
            switch (priority) {
                case 3: return '#e74c3c'; // High - red
                case 2: return '#f39c12'; // Normal - orange
                case 1: return '#95a5a6'; // Low - gray
                default: return '#95a5a6';
            }
        },

        /**
         * Get status icon
         */
        getStatusIcon(status) {
            const icons = {
                'pending': '⏳',
                'active': '⬆️',
                'downloading': '⬇️',
                'uploading': '⬆️',
                'paused': '⏸️',
                'completed': '✅',
                'error': '❌',
                'cancelled': '🚫'
            };
            return icons[status] || '❓';
        },

        /**
         * Format transfer speed
         */
        formatSpeed(bytesPerSecond) {
            if (!bytesPerSecond) return '—';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
            
            return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i] + '/s';
        },

        /**
         * Format file size
         */
        formatFileSize(bytes) {
            if (!bytes || bytes === 0) return '—';
            
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        /**
         * Format time duration
         */
        formatTimeRemaining(seconds) {
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
        },

        /**
         * Format elapsed time
         */
        formatElapsedTime(startTime, endTime = null) {
            if (!startTime) return '—';
            
            const elapsed = (endTime || Date.now()) - startTime;
            return this.formatTimeRemaining(elapsed / 1000);
        },

        /**
         * Get file icon based on file name
         */
        getFileIcon(fileName) {
            if (!fileName) return '📄';
            
            const extension = fileName.split('.').pop()?.toLowerCase();
            
            const iconMap = {
                // Images
                'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️', 'webp': '🖼️',
                // Documents
                'pdf': '📄', 'doc': '📝', 'docx': '📝', 'txt': '📝', 'rtf': '📝',
                // Spreadsheets
                'xls': '📊', 'xlsx': '📊', 'csv': '📊',
                // Presentations
                'ppt': '📽️', 'pptx': '📽️',
                // Archives
                'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
                // Code
                'js': '📜', 'html': '🌐', 'css': '🎨', 'json': '📋', 'xml': '📋',
                'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️', 'cs': '⚙️',
                // Video
                'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', 'wmv': '🎬',
                // Audio
                'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'ogg': '🎵',
                // Other
                'exe': '⚙️', 'dmg': '💿', 'iso': '💿', 'apk': '📱'
            };
            
            return iconMap[extension] || '📄';
        },

        /**
         * Clear completed transfers from history
         */
        clearCompleted() {
            if (!window.ProgressTracker) return;
            
            const completedCount = this.transferHistory.filter(t => t.status === 'completed').length;
            this.transferHistory = this.transferHistory.filter(t => t.status !== 'completed');
            
            this.showNotification(`Cleared ${completedCount} completed transfers from history`, 'info');
        },

        /**
         * Clear failed transfers from history
         */
        clearFailed() {
            if (!window.ProgressTracker) return;
            
            const failedCount = this.transferHistory.filter(t => t.status === 'error').length;
            this.transferHistory = this.transferHistory.filter(t => t.status !== 'error');
            
            this.showNotification(`Cleared ${failedCount} failed transfers from history`, 'info');
        },

        /**
         * Retry failed transfer
         */
        retryTransfer(transferId) {
            if (!window.ProgressTracker) return;
            
            const transfer = window.ProgressTracker.getTransfer(transferId);
            if (transfer && transfer.status === 'error') {
                // Note: This would need to be implemented in the transfer system
                // For now, just show a notification
                this.showNotification('Retry functionality would be implemented by the transfer system', 'info');
            }
        },

        /**
         * Show notification
         */
        showNotification(message, type = 'info') {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease;
            `;
            
            // Set background color based on type
            const colors = {
                'success': '#27ae60',
                'error': '#e74c3c',
                'warning': '#f39c12',
                'info': '#3498db'
            };
            notification.style.backgroundColor = colors[type] || colors.info;
            
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        },

        /**
         * Get network quality indicator HTML
         */
        getNetworkQualityIndicator() {
            return `
                <div class="network-quality-indicator" style="color: ${this.networkQuality.color}">
                    <span class="quality-icon">${this.getNetworkQualityIcon()}</span>
                    <span class="quality-label">${this.networkQuality.label}</span>
                    <span class="quality-speed">(${this.formatSpeed(this.networkQuality.speed)})</span>
                </div>
            `;
        },

        /**
         * Get network quality icon
         */
        getNetworkQualityIcon() {
            const icons = {
                'EXCELLENT': '🚀',
                'GOOD': '🚗',
                'FAIR': '🚲',
                'POOR': '🐌',
                'UNKNOWN': '❓'
            };
            return icons[this.networkQuality.quality] || icons.UNKNOWN;
        },

        /**
         * Get bandwidth usage percentage
         */
        getBandwidthPercentage() {
            // Calculate based on typical internet speeds
            const maxSpeed = 100 * 1024 * 1024; // 100 MB/s as reference
            return Math.min(100, (this.bandwidthUsage.totalSpeed / maxSpeed) * 100);
        },

        /**
         * Destroy component
         */
        destroy() {
            this.stopAutoRefresh();
            if (window.ProgressTracker) {
                window.ProgressTracker.removeProgressCallback(this.handleProgressEvent.bind(this));
            }
        }
    };
}

// Register the component
window.progressDashboard = progressDashboard;