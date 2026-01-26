/**
 * Main S3 File Browser Application
 * Modular Alpine.js-based file browser with support for uploads, downloads, and previews
 */
document.addEventListener('alpine:initialized', () => {
    console.log('S3 File Browser App Initialized');
});

/**
 * File Browser Alpine.js Component
 * Main application state and methods
 */
window.fileBrowserApp = {
    // ==================== State ====================
    
    // Navigation state
    path: '/',
    items: [],
    breadcrumbs: [],
    loading: false,
    error: '',
    
    // Bucket state
    currentBucket: '',
    availableBuckets: [],
    bucketInfos: [],
    
    // Modal states
    showCreateFolderModal: false,
    showDeleteModal: false,
    showUploadModal: false,
    newFolderName: '',
    itemToDelete: null,

    // Component instances
    uploadComponent: null,
    downloadComponentInstance: null,
    progressDashboardInstance: null,
    imagePreviewInstance: null,
    
    // Panel states
    showDownloadsPanel: false,
    downloadCount: 0,
    showProgressDashboard: false,
    showImagePreview: false,
    
    // Transfer stats
    networkQuality: 'UNKNOWN',
    totalBandwidthUsage: 0,
    activeTransferCount: 0,
    
    // ==================== Computed Properties ====================
    
    get itemCount() {
        return this.items.length;
    },
    
    // ==================== Lifecycle Methods ====================
    
    async init() {
        try {
            // Initialize upload component
            if (window.UploadComponent) {
                this.uploadComponent = window.UploadComponent(this.path);
            }
            
            // Load available buckets
            await this.loadBuckets();
            
            // Initialize download component
            if (window.DownloadProgressComponent) {
                this.downloadComponentInstance = window.DownloadProgressComponent();
            }
            
            // Initialize progress dashboard
            if (window.ProgressDashboard) {
                this.progressDashboardInstance = window.ProgressDashboard();
                this.startTransferStatsUpdater();
            }
            
            // Initialize image preview component
            this.initializeImagePreview();
            
            // Load initial files
            await this.loadFiles();
            
            // Start download count updater
            this.startDownloadCountUpdater();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.error = 'Failed to initialize application';
        }
    },
    
    initializeImagePreview() {
        if (!window.ImagePreviewComponent) return;
        
        const imagePreviewComponent = window.ImagePreviewComponent();
        
        // Set up two-way binding for showImagePreview state
        Object.defineProperty(imagePreviewComponent, 'showImagePreview', {
            get: () => this.showImagePreview,
            set: (value) => { this.showImagePreview = value; }
        });
        
        // Bind Alpine.js utilities
        imagePreviewComponent.$refs = this.$refs;
        imagePreviewComponent.$nextTick = this.$nextTick;
        imagePreviewComponent.$el = this.$el;
        
        this.imagePreviewInstance = imagePreviewComponent;
        window.imagePreviewComponent = this.imagePreviewInstance;
    },
    
    startTransferStatsUpdater() {
        setInterval(() => this.updateTransferStats(), 2000);
    },
    
    startDownloadCountUpdater() {
        setInterval(() => this.updateDownloadCount(), 1000);
    },
    
    // ==================== File Operations ====================
    
    async loadFiles(currentPath = this.path) {
        this.loading = true;
        this.error = '';
        
        try {
            // Update component bucket references
            if (this.uploadComponent) this.uploadComponent.currentBucket = this.currentBucket;
            if (this.imagePreviewInstance) this.imagePreviewInstance.currentBucket = this.currentBucket;

            const response = await window.FilesAPI.list(currentPath, this.currentBucket || null);
            
            if (response.success) {
                this.path = response.data.path;
                this.items = response.data.items;
                this.breadcrumbs = response.data.breadcrumbs;
            } else {
                this.error = response.error?.message || 'Failed to load files';
            }
        } catch (error) {
            console.error('Error loading files:', error);
            this.error = error.message || 'Failed to load files. Please try again.';
        } finally {
            this.loading = false;
        }
    },
    
    async refreshFiles() {
        await this.loadFiles();
    },
    
    async navigateTo(path) {
        if (path !== this.path) {
            await this.loadFiles(path);
        }
    },
    
    handleItemClick(item) {
        console.log('Item clicked:', item);
    },
    
    async handleItemDoubleClick(item) {
        if (item.type === 'folder') {
            await this.navigateTo(item.path);
        }
    },
    
    // ==================== Download Operations ====================
    
    async downloadItem(item) {
        try {
            if (window.DownloadHelper) {
                await window.DownloadHelper.downloadFile(
                    item.path,
                    (download) => {
                        console.log(`Download progress: ${download.fileName} - ${download.progress.toFixed(1)}%`);
                    },
                    this.currentBucket,
                    { fileName: item.name, fileSize: item.size || 0 }
                );
                
                this.notify(`Download started: ${item.name}`, 'info');
                this.showDownloadsPanel = true;
            } else {
                await this.downloadItemFallback(item);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            this.error = 'Failed to download file. Please try again.';
        }
    },
    
    async downloadItemFallback(item) {
        this.loading = true;
        
        try {
            const response = await window.FilesAPI.getDownloadUrl(item.path, this.currentBucket);
            
            if (response.success) {
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.download = item.name;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.notify(`Downloaded: ${item.name}`, 'success');
            } else {
                this.error = response.error?.message || 'Failed to download file';
            }
        } finally {
            this.loading = false;
        }
    },
    
    async downloadItems(items) {
        const fileItems = items.filter(item => item.type === 'file');
        
        if (fileItems.length === 0) {
            this.notify('No files selected for download', 'warning');
            return;
        }
        
        if (fileItems.length === 1) {
            await this.downloadItem(fileItems[0]);
            return;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const item of fileItems) {
            try {
                if (window.DownloadHelper) {
                    await window.DownloadHelper.downloadFile(item.path, null, this.currentBucket, {
                        fileName: item.name,
                        fileSize: item.size || 0
                    });
                } else {
                    await this.downloadItem(item);
                }
                successCount++;
            } catch (error) {
                console.error(`Failed to download ${item.name}:`, error);
                errorCount++;
            }
        }
        
        if (window.DownloadHelper && fileItems.length > 1) {
            this.showDownloadsPanel = true;
        }
        
        const message = errorCount === 0
            ? `Started downloading ${successCount} file(s)`
            : `Downloaded ${successCount} file(s), ${errorCount} failed`;
        
        this.notify(message, errorCount === 0 ? 'success' : 'warning');
    },
    
    downloadSelected() {
        const selectedFiles = this.getSelectedFiles();
        if (selectedFiles.length === 0) {
            this.notify('No files selected', 'warning');
            return;
        }
        this.downloadItems(selectedFiles);
    },
    
    // ==================== Folder Operations ====================
    
    async createFolder() {
        if (!this.newFolderName.trim()) return;
        
        try {
            this.loading = true;
            const folderPath = this.path === '/' ? this.newFolderName : `${this.path}/${this.newFolderName}`;
            
            const response = await window.FilesAPI.createFolder(folderPath, this.currentBucket);
            
            if (response.success) {
                this.showCreateFolderModal = false;
                this.newFolderName = '';
                await this.refreshFiles();
                this.notify('Folder created successfully', 'success');
            } else {
                this.error = response.error?.message || 'Failed to create folder';
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            this.error = error.message || 'Failed to create folder. Please try again.';
        } finally {
            this.loading = false;
        }
    },
    
    // ==================== Delete Operations ====================
    
    deleteItem(item) {
        this.itemToDelete = item;
        this.showDeleteModal = true;
    },
    
    async confirmDelete() {
        if (!this.itemToDelete) return;
        
        try {
            this.loading = true;
            const response = await window.FilesAPI.delete(this.itemToDelete.path, this.currentBucket);
            
            if (response.success) {
                this.showDeleteModal = false;
                this.itemToDelete = null;
                await this.refreshFiles();
                this.notify('Item deleted successfully', 'success');
            } else {
                this.error = response.error?.message || 'Failed to delete item';
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            this.error = error.message || 'Failed to delete item. Please try again.';
        } finally {
            this.loading = false;
        }
    },
    
    // ==================== Image Preview ====================
    
    isImageFile(item) {
        return window.FileUtils?.isImageFile(item) ?? false;
    },
    
    async previewImage(item) {
        if (item.type !== 'file') return;
        
        if (!this.isImageFile(item)) {
            this.notify('This file is not a supported image format', 'warning');
            return;
        }
        
        if (this.imagePreviewInstance) {
            try {
                await this.imagePreviewInstance.openPreview(item);
                this.showImagePreview = true;
            } catch (error) {
                console.error('Failed to open image preview:', error);
                this.notify('Failed to open image preview', 'error');
            }
        } else {
            this.notify('Image preview not available', 'warning');
        }
    },
    
    async previewImages(items, startIndex = 0) {
        if (!Array.isArray(items) || items.length === 0) return;
        
        const imageItems = items.filter(item => this.isImageFile(item));
        
        if (imageItems.length === 0) {
            this.notify('No supported images found', 'warning');
            return;
        }
        
        if (this.imagePreviewInstance) {
            try {
                await this.imagePreviewInstance.openPreviewWithImages(imageItems, startIndex);
                this.showImagePreview = true;
            } catch (error) {
                console.error('Failed to open image preview:', error);
                this.notify('Failed to open image preview', 'error');
            }
        } else {
            this.notify('Image preview not available', 'warning');
        }
    },
    
    previewSelectedImages() {
        const selectedFiles = this.getSelectedFiles();
        if (selectedFiles.length === 0) {
            this.notify('No files selected', 'warning');
            return;
        }
        this.previewImages(selectedFiles);
    },
    
    // ==================== Upload Operations ====================
    
    showUpload() {
        if (this.uploadComponent) {
            this.uploadComponent.currentPath = this.path;
            this.uploadComponent.currentBucket = this.currentBucket;
        }
        this.showUploadModal = true;
    },
    
    hideUpload() {
        this.showUploadModal = false;
    },
    
    async onUploadComplete(uploadData) {
        console.log('onUploadComplete called with:', uploadData);
        
        if (uploadData && uploadData.completedFiles > 0) {
            await this.refreshFiles();
            
            const message = uploadData.hasErrors 
                ? `${uploadData.completedFiles} file(s) uploaded (${uploadData.totalFiles - uploadData.completedFiles} failed)`
                : `${uploadData.completedFiles} file(s) uploaded successfully!`;
            
            this.notify(message, uploadData.hasErrors ? 'warning' : 'success');
        }
    },
    
    // ==================== Bucket Operations ====================
    
    async loadBuckets() {
        try {
            const response = await window.BucketsAPI.list(true);
            
            if (response.success) {
                this.availableBuckets = response.data.buckets.map(b => b.name);
                this.bucketInfos = response.data.buckets;
                
                const defaultBucket = response.data.buckets.find(b => b.isDefault);
                if (defaultBucket && defaultBucket.isAccessible) {
                    this.currentBucket = defaultBucket.name;
                } else {
                    const accessibleBucket = response.data.buckets.find(b => b.isAccessible);
                    this.currentBucket = accessibleBucket ? accessibleBucket.name : '';
                }
            }
        } catch (error) {
            console.error('Error loading buckets:', error);
            this.error = 'Failed to load buckets';
        }
    },

    async switchBucket(bucketName) {
        this.loading = true;
        
        try {
            const response = await window.BucketsAPI.switch(bucketName);
            
            if (response.success) {
                this.currentBucket = bucketName;
                this.path = '/';
                await this.loadFiles();
                this.notify(`Switched to bucket: ${bucketName}`, 'success');
            } else {
                this.error = response.error?.message || 'Failed to switch bucket';
            }
        } catch (error) {
            console.error('Error switching bucket:', error);
            this.error = error.message || 'Failed to switch bucket. Please try again.';
        } finally {
            this.loading = false;
        }
    },

    getBucketStatus(bucketName) {
        if (!this.bucketInfos) return { icon: '📦', text: 'Unknown', class: '' };
        
        const bucket = this.bucketInfos.find(b => b.name === bucketName);
        if (!bucket) return { icon: '📦', text: 'Unknown', class: '' };
        
        if (!bucket.isAccessible) {
            return { icon: '🔒', text: 'Inaccessible', class: 'bucket-inaccessible' };
        }
        if (bucket.isDefault) {
            return { icon: '⭐', text: 'Default', class: 'bucket-default' };
        }
        return { icon: '📦', text: 'Accessible', class: 'bucket-accessible' };
    },
    
    // ==================== Selection Operations ====================
    
    selectAllFiles() {
        document.querySelectorAll('.file-select-checkbox').forEach(cb => { cb.checked = true; });
    },
    
    clearSelection() {
        document.querySelectorAll('.file-select-checkbox').forEach(cb => { cb.checked = false; });
    },
    
    getSelectedFiles() {
        const checkboxes = document.querySelectorAll('.file-select-checkbox:checked');
        return Array.from(checkboxes).map(checkbox => {
            const itemElement = checkbox.closest('.file-item');
            if (itemElement && itemElement._x_dataStack) {
                return itemElement._x_dataStack[0].item;
            }
            return null;
        }).filter(item => item !== null);
    },
    
    // ==================== Transfer Management ====================
    
    updateDownloadCount() {
        if (this.downloadComponentInstance && this.downloadComponentInstance.hasActiveDownloads) {
            this.downloadCount = this.downloadComponentInstance.activeDownloads.length;
        } else {
            this.downloadCount = 0;
        }
    },
    
    toggleDownloadsPanel() {
        this.showDownloadsPanel = !this.showDownloadsPanel;
    },
    
    toggleProgressDashboard() {
        this.showProgressDashboard = !this.showProgressDashboard;
        if (this.showProgressDashboard && this.progressDashboardInstance) {
            this.progressDashboardInstance.init();
        }
    },
    
    updateTransferStats() {
        if (!window.ProgressTracker) return;
        
        const stats = window.ProgressTracker.getGlobalStatistics();
        this.networkQuality = stats.networkQuality || 'UNKNOWN';
        this.totalBandwidthUsage = stats.totalBandwidthUsage || 0;
        this.activeTransferCount = stats.activeTransferCount || 0;
    },
    
    pauseAllTransfers() {
        if (window.ProgressTracker) {
            window.ProgressTracker.pauseAllTransfers();
            this.notify('All transfers paused', 'info');
        }
    },
    
    resumeAllTransfers() {
        if (window.ProgressTracker) {
            window.ProgressTracker.resumeAllTransfers();
            this.notify('All transfers resumed', 'info');
        }
    },
    
    cancelAllTransfers() {
        if (!window.ProgressTracker) return;
        
        const activeCount = window.ProgressTracker.getGlobalStatistics().activeTransferCount;
        if (activeCount > 0) {
            if (confirm(`Are you sure you want to cancel ${activeCount} active transfer(s)?`)) {
                window.ProgressTracker.cancelAllTransfers();
                this.notify('All transfers cancelled', 'warning');
            }
        } else {
            this.notify('No active transfers to cancel', 'info');
        }
    },
    
    // ==================== Utility Methods ====================
    
    notify(message, type = 'info') {
        if (window.Notifications) {
            window.Notifications.show(message, type);
        } else if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    },
    
    getFileIcon(type, name) {
        if (window.FileUtils) {
            return window.FileUtils.getFileIcon(type, name);
        }
        
        // Fallback
        if (type === 'folder') return '📁';
        const ext = name?.split('.').pop()?.toLowerCase();
        const icons = { pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️' };
        return icons[ext] || '📄';
    },
    
    formatSize(bytes) {
        if (window.FileUtils) {
            return window.FileUtils.formatFileSize(bytes);
        }
        if (bytes === 0) return '—';
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    formatDate(dateString) {
        if (window.FileUtils) {
            return window.FileUtils.formatDate(dateString);
        }
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
    },
    
    formatFileSize(bytes) {
        return this.formatSize(bytes);
    },
    
    formatSpeed(bytesPerSecond) {
        if (window.FileUtils) {
            return window.FileUtils.formatSpeed(bytesPerSecond);
        }
        if (!bytesPerSecond) return '—';
        return this.formatSize(bytesPerSecond) + '/s';
    },
    
    formatTime(seconds) {
        if (window.FileUtils) {
            return window.FileUtils.formatTime(seconds);
        }
        if (!seconds || seconds < 0) return '—';
        if (seconds < 60) return Math.round(seconds) + 's';
        if (seconds < 3600) return Math.round(seconds / 60) + 'm';
        return Math.floor(seconds / 3600) + 'h ' + Math.round((seconds % 3600) / 60) + 'm';
    },
    
    getStatusIcon(status) {
        const icons = {
            pending: '⏳', uploading: '⬆️', completed: '✅', error: '❌', paused: '⏸️'
        };
        return icons[status] || '❓';
    },
};

// Legacy API request function for backwards compatibility
window.downloadFileFallback = async function(item) {
    try {
        const response = await window.FilesAPI.getDownloadUrl(item.path);
        
        if (response.success) {
            const link = document.createElement('a');
            link.href = response.data.downloadUrl;
            link.download = item.name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert('Failed to download file: ' + (response.error?.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        alert('Failed to download file. Please try again.');
    }
};
