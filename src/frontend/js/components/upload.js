/**
 * Upload Component
 * Handles the UI for file uploads with drag-and-drop support
 */

/**
 * Upload Component Alpine.js Data
 */
window.UploadComponent = function(currentPath, currentBucket) {
    return {
        // Component state
        isVisible: false,
        isDragging: false,
        files: [],
        uploads: [],
        currentPath: currentPath || '/',
        currentBucket: currentBucket || null,
        
        // Upload configuration
        maxFileSize: window.UploadHelper?.UPLOAD_CONFIG?.MAX_FILE_SIZE || (2 * 1024 * 1024 * 1024), // 2GB default
        allowedTypes: window.UploadHelper?.UPLOAD_CONFIG?.ALLOWED_TYPES || [],
        maxFiles: 10,
        
        // UI state
        uploadQueue: [],
        isUploading: false,
        uploadProgress: 0,
        
        /**
         * Initialize the upload component
         */
        init() {
            // Set up drag and drop event listeners
            this.setupDragAndDrop();
            
            // Watch for changes in upload states
            this.$watch('uploads', () => {
                this.updateUploadButtonState();
            });
        },
        
        /**
         * Set up drag and drop event listeners
         */
        setupDragAndDrop() {
            // Use document.querySelector instead of this.$el to avoid Alpine.js scope issues
            const dropZone = document.querySelector('.upload-drop-zone');
            
            if (!dropZone) return;
            
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, this.preventDefaults, false);
                document.body.addEventListener(eventName, this.preventDefaults, false);
            });
            
            // Highlight drop zone when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    this.isDragging = true;
                }, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    this.isDragging = false;
                }, false);
            });
            
            // Handle dropped files
            dropZone.addEventListener('drop', this.handleDrop.bind(this), false);
        },
        
        /**
         * Prevent default drag behaviors
         */
        preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        
        /**
         * Open file selection dialog
         */
        selectFiles() {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
            input.click();
        },
        
        /**
         * Handle file selection from input
         */
        handleFileSelect(fileList) {
            const files = Array.from(fileList);
            this.addFiles(files);
        },
        
        /**
         * Handle drag and drop file drop
         */
        handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            this.handleFileSelect(files);
        },
        
        /**
         * Add files to the upload queue
         */
        addFiles(files) {
            if (this.uploads.length + files.length > this.maxFiles) {
                this.showError(`Maximum ${this.maxFiles} files allowed per upload`);
                return;
            }
            
            files.forEach(file => {
                // Check if file already exists in queue
                if (this.uploads.findIndex(upload => upload.file.name === file.name && upload.file.size === file.size) !== -1) {
                    return;
                }
                
                // Validate file
                const validation = window.UploadHelper.validateFile(file);
                if (!validation.valid) {
                    this.showError(`File "${file.name}": ${validation.error}`);
                    return;
                }
                
                // Add to upload queue
                const upload = {
                    id: Date.now() + Math.random(),
                    file: file,
                    path: this.currentPath,
                    status: 'pending', // pending, uploading, completed, error, paused
                    progress: 0,
                    bytesUploaded: 0,
                    totalBytes: file.size,
                    startTime: null,
                    endTime: null,
                    speed: 0,
                    timeRemaining: null,
                    error: null,
                    retryCount: 0
                };
                
                this.uploads.push(upload);
            });
        },
        
        /**
         * Remove file from upload queue
         */
        removeFile(uploadId) {
            const index = this.uploads.findIndex(upload => upload.id === uploadId);
            if (index !== -1) {
                const upload = this.uploads[index];
                
                // Don't remove if currently uploading
                if (upload.status === 'uploading') {
                    if (confirm('File is currently uploading. Are you sure you want to remove it?')) {
                        // Cancel upload (would need implementation in upload helper)
                        this.uploads.splice(index, 1);
                    }
                    return;
                }
                
                this.uploads.splice(index, 1);
            }
        },
        
        /**
         * Start uploading all pending files
         */
        async startUpload() {
            if (this.isUploading) return;
            
            this.isUploading = true;
            
            try {
                const pendingUploads = this.uploads.filter(upload => upload.status === 'pending');
                
                // Upload files sequentially (can be made concurrent if needed)
                for (const upload of pendingUploads) {
                    if (upload.status !== 'pending') continue;
                    
                    try {
                        await this.uploadSingleFile(upload);
                    } catch (error) {
                        console.error('Upload failed:', error);
                        upload.status = 'error';
                        upload.error = error.message;
                    }
                }
                
                // After all uploads are done, notify parent app
                this.notifyUploadComplete();
            } finally {
                this.isUploading = false;
                this.updateUploadButtonState();
            }
        },
        
        /**
         * Upload a single file
         */
        async uploadSingleFile(upload) {
            upload.status = 'uploading';
            upload.startTime = Date.now();
            
            const progressCallback = (uploadState) => {
                // Update upload object with progress
                upload.progress = uploadState.progress;
                upload.bytesUploaded = uploadState.bytesUploaded;
                upload.speed = uploadState.speed;
                upload.timeRemaining = uploadState.timeRemaining;
                upload.status = uploadState.status;
                upload.error = uploadState.error; // This should be the error message string, not the method
                upload.retryCount = uploadState.retryCount;
            };
            
            try {
                const result = await window.UploadHelper.uploadFile(
                    upload.file,
                    upload.path,
                    progressCallback,
                    this.currentBucket
                );
                
                upload.status = 'completed';
                upload.endTime = Date.now();
                upload.progress = 100;
                
                // Show success notification
                this.showSuccess(`File "${upload.file.name}" uploaded successfully!`);
                
                // Notify parent app of upload completion
                this.notifyUploadComplete(result);
                
                return result;
                
            } catch (error) {
                upload.status = 'error';
                upload.error = error.message;
                upload.endTime = Date.now();
                
                this.showError(`Upload failed for "${upload.file.name}": ${error.message}`);
                throw error;
            }
        },
        
        /**
         * Retry failed upload
         */
        async retryUpload(uploadId) {
            const upload = this.uploads.find(u => u.id === uploadId);
            if (!upload) return;
            
            // Reset upload state
            upload.status = 'pending';
            upload.progress = 0;
            upload.bytesUploaded = 0;
            upload.error = null;
            upload.startTime = null;
            upload.endTime = null;
            upload.speed = 0;
            upload.timeRemaining = null;
            
            // Start upload
            await this.uploadSingleFile(upload);
        },
        
        /**
         * Clear completed or failed uploads
         */
        clearUploads() {
            this.uploads = this.uploads.filter(upload => 
                upload.status === 'pending' || upload.status === 'uploading'
            );
        },
        
        /**
         * Update upload button states
         */
        updateUploadButtonState() {
            const hasPending = this.uploads.some(upload => upload.status === 'pending');
            const hasUploading = this.uploads.some(upload => upload.status === 'uploading');
            
            // Disable start button if no pending files or already uploading
            // Use document.querySelector instead of this.$el to avoid Alpine.js scope issues
            const startButton = document.querySelector('.upload-start-btn');
            if (startButton) {
                startButton.disabled = !hasPending || hasUploading;
            }
        },
        
        /**
         * Show upload modal/panel
         */
        show() {
            this.isVisible = true;
        },
        
        /**
         * Hide upload modal/panel
         */
        hide() {
            // Don't hide if uploads are in progress
            const hasUploading = this.uploads.some(upload => upload.status === 'uploading');
            if (hasUploading) {
                if (!confirm('Uploads are in progress. Are you sure you want to close?')) {
                    return;
                }
            }
            
            this.isVisible = false;
        },
        
        /**
         * Get formatted file size
         */
        formatFileSize(bytes) {
            return window.UploadHelper.formatFileSize(bytes);
        },
        
        /**
         * Get formatted upload speed
         */
        formatSpeed(bytesPerSecond) {
            return window.UploadHelper.formatSpeed(bytesPerSecond);
        },
        
        /**
         * Get formatted time remaining
         */
        formatTime(seconds) {
            return window.UploadHelper.formatTime(seconds);
        },
        
        /**
         * Get upload status icon
         */
        getStatusIcon(status) {
            const icons = {
                'pending': '⏳',
                'uploading': '⬆️',
                'completed': '✅',
                'error': '❌',
                'paused': '⏸️'
            };
            return icons[status] || '❓';
        },
        
        /**
         * Get file icon based on file type
         */
        getFileIcon(file) {
            if (!file) return '📄';
            
            const fileName = file.name || '';
            const extension = fileName.split('.').pop()?.toLowerCase();
            const mimeType = file.type || '';
            
            // Check for known types
            if (mimeType.startsWith('image/')) return '🖼️';
            if (mimeType.startsWith('video/')) return '🎬';
            if (mimeType.startsWith('audio/')) return '🎵';
            if (mimeType === 'application/pdf') return '📄';
            if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';
            
            // Check file extension
            const iconMap = {
                'pdf': '📄',
                'doc': '📝', 'docx': '📝',
                'txt': '📄',
                'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
                'mp4': '🎬', 'mov': '🎬', 'avi': '🎬',
                'mp3': '🎵', 'wav': '🎵',
                'zip': '📦', 'rar': '📦', 'tar': '📦', 'gz': '📦',
                'js': '📜', 'ts': '📜', 'html': '🌐', 'css': '🎨',
                'json': '📋', 'xml': '📋', 'csv': '📊',
                'xls': '📊', 'xlsx': '📊', 'ppt': '📊', 'pptx': '📊'
            };
            
            return iconMap[extension] || '📄';
        },
        
        /**
         * Show error message
         */
        showError(message) {
            // Dispatch error event to parent app
            if (window.fileBrowserApp) {
                window.fileBrowserApp.error = message;
            }
        },
        
        /**
         * Show success message
         */
        showSuccess(message) {
            // Could implement a toast notification here
            console.log('Upload success:', message);
        },
        
        /**
         * Get overall upload progress
         */
        get overallProgress() {
            if (this.uploads.length === 0) return 0;
            
            const totalBytes = this.uploads.reduce((sum, upload) => sum + upload.totalBytes, 0);
            const uploadedBytes = this.uploads.reduce((sum, upload) => sum + upload.bytesUploaded, 0);
            
            return totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
        },
        
        /**
         * Get upload summary
         */
        get uploadSummary() {
            const pending = this.uploads.filter(u => u.status === 'pending').length;
            const uploading = this.uploads.filter(u => u.status === 'uploading').length;
            const completed = this.uploads.filter(u => u.status === 'completed').length;
            const errors = this.uploads.filter(u => u.status === 'error').length;
            
            return { pending, uploading, completed, errors };
        },
        
        /**
         * Notify parent app of upload completion
         */
        notifyUploadComplete(result) {
            // Find if all uploads are completed
            const allUploads = this.uploads;
            const completedUploads = allUploads.filter(u => u.status === 'completed');
            const hasErrors = allUploads.some(u => u.status === 'error');
            const allCompleted = completedUploads.length > 0 && !allUploads.some(u => u.status === 'pending' || u.status === 'uploading');
            
            // Debounce refresh calls to prevent excessive API requests
            if (this.refreshTimeout) {
                clearTimeout(this.refreshTimeout);
            }
            
            this.refreshTimeout = setTimeout(() => {
                // Check if parent app has onUploadComplete method
                if (window.fileBrowserApp && typeof window.fileBrowserApp.onUploadComplete === 'function') {
                    // Call the parent app's onUploadComplete method
                    window.fileBrowserApp.onUploadComplete({
                        result: result,
                        completedFiles: completedUploads.length,
                        totalFiles: allUploads.length,
                        hasErrors: hasErrors,
                        allCompleted: allCompleted
                    });
                }
            }, 500); // 500ms delay to batch rapid completions
        }
    };
};