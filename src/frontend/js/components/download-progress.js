/**
 * Download Progress Component
 * Alpine.js component for displaying and managing download progress
 */

/**
 * Download Progress Alpine.js Component
 */
window.DownloadProgressComponent = function() {
    return {
        // Data
        downloads: [],
        showHistory: false,
        
        // Computed properties
        get activeDownloads() {
            return this.downloads.filter(d => ['pending', 'downloading', 'paused'].includes(d.status));
        },
        
        get completedDownloads() {
            return this.downloads.filter(d => d.status === 'completed');
        },
        
        get failedDownloads() {
            return this.downloads.filter(d => d.status === 'error');
        },
        
        get hasActiveDownloads() {
            return this.activeDownloads.length > 0;
        },
        
        get downloadQueue() {
            if (!this._downloadQueue && window.DownloadHelper && window.DownloadHelper.getDownloadQueue) {
                this._downloadQueue = window.DownloadHelper.getDownloadQueue();
            }
            return this._downloadQueue;
        },
        
        // Methods
        init() {
            // Check if DownloadHelper is available
            if (!window.DownloadHelper) {
                console.warn('DownloadHelper not available');
                return;
            }
            
            // Get existing downloads from queue
            this.refreshDownloads();
            
            // Add progress callback if queue is available
            if (this.downloadQueue && this.downloadQueue.addProgressCallback) {
                this.downloadQueue.addProgressCallback((download) => {
                    this.updateDownloadItem(download);
                });
            }
            
            // Refresh downloads periodically
            setInterval(() => {
                this.refreshDownloads();
            }, 1000);
        },
        
        refreshDownloads() {
            // Check if download queue is available
            if (!this.downloadQueue) return;
            
            const allDownloads = [
                ...(this.downloadQueue.getActiveDownloads?.() || []),
                ...(this.downloadQueue.getCompletedDownloads?.() || []),
                ...(this.downloadQueue.getFailedDownloads?.() || [])
            ];
            
            // Only update if there are changes
            const hasChanges = allDownloads.length !== this.downloads.length ||
                allDownloads.some(download => {
                    const existing = this.downloads.find(d => d.id === download.id);
                    return !existing || existing.status !== download.status || 
                           existing.progress !== download.progress;
                });
            
            if (hasChanges) {
                this.downloads = allDownloads.sort((a, b) => {
                    // Sort by status and creation time
                    const statusOrder = {
                        'downloading': 0,
                        'pending': 1,
                        'paused': 2,
                        'error': 3,
                        'completed': 4
                    };
                    
                    const aStatus = statusOrder[a.status] || 999;
                    const bStatus = statusOrder[b.status] || 999;
                    
                    if (aStatus !== bStatus) {
                        return aStatus - bStatus;
                    }
                    
                    return (b.startTime || 0) - (a.startTime || 0);
                });
            }
        },
        
        updateDownloadItem(download) {
            const index = this.downloads.findIndex(d => d.id === download.id);
            if (index >= 0) {
                this.downloads.splice(index, 1, { ...download });
            } else {
                this.downloads.push({ ...download });
            }
        },
        
        pauseDownload(downloadId) {
            if (window.DownloadHelper.pauseDownload(downloadId)) {
                this.showNotification('Download paused', 'info');
            }
        },
        
        resumeDownload(downloadId) {
            if (window.DownloadHelper.resumeDownload(downloadId)) {
                this.showNotification('Download resumed', 'info');
            }
        },
        
        cancelDownload(downloadId) {
            if (window.DownloadHelper.cancelDownload(downloadId)) {
                this.showNotification('Download cancelled', 'info');
            }
        },
        
        retryDownload(downloadId) {
            if (window.DownloadHelper.retryDownload(downloadId)) {
                this.showNotification('Download retrying...', 'info');
            }
        },
        
        clearCompleted() {
            this.downloadQueue.clearCompleted();
            this.refreshDownloads();
            this.showNotification('Completed downloads cleared', 'success');
        },
        
        clearFailed() {
            this.downloadQueue.clearFailed();
            this.refreshDownloads();
            this.showNotification('Failed downloads cleared', 'success');
        },
        
        getStatusIcon(status) {
            const icons = {
                'pending': '⏳',
                'downloading': '⬇️',
                'paused': '⏸️',
                'completed': '✅',
                'error': '❌',
                'cancelled': '🚫'
            };
            return icons[status] || '❓';
        },
        
        getStatusColor(status) {
            const colors = {
                'pending': '#666',
                'downloading': '#3498db',
                'paused': '#f39c12',
                'completed': '#27ae60',
                'error': '#e74c3c',
                'cancelled': '#95a5a6'
            };
            return colors[status] || '#666';
        },
        
        formatFileSize(bytes) {
            return window.DownloadHelper.formatFileSize(bytes);
        },
        
        formatSpeed(bytesPerSecond) {
            return window.DownloadHelper.formatSpeed(bytesPerSecond);
        },
        
        formatTime(seconds) {
            return window.DownloadHelper.formatTime(seconds);
        },
        
        showNotification(message, type = 'info') {
            // Use the main app's notification system if available
            if (window.fileBrowserApp && typeof window.fileBrowserApp.showNotification === 'function') {
                window.fileBrowserApp.showNotification(message, type);
            } else {
                // Fallback notification
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        },
        
        getFileIcon(fileName) {
            if (!fileName) return '📄';
            
            const extension = fileName.split('.').pop()?.toLowerCase();
            
            const iconMap = {
                'pdf': '📄',
                'doc': '📝',
                'docx': '📝',
                'txt': '📄',
                'jpg': '🖼️',
                'jpeg': '🖼️',
                'png': '🖼️',
                'gif': '🖼️',
                'svg': '🖼️',
                'mp4': '🎬',
                'mov': '🎬',
                'avi': '🎬',
                'mp3': '🎵',
                'wav': '🎵',
                'zip': '📦',
                'rar': '📦',
                'tar': '📦',
                'gz': '📦',
                'js': '📜',
                'ts': '📜',
                'html': '🌐',
                'css': '🎨',
                'json': '📋',
                'xml': '📋',
                'csv': '📊',
                'xls': '📊',
                'xlsx': '📊',
                'ppt': '📊',
                'pptx': '📊',
            };
            
            return iconMap[extension] || '📄';
        }
    };
};

// Register the component for Alpine.js x-data reference
window.downloadComponent = window.DownloadProgressComponent;
