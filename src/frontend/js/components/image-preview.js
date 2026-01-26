/**
 * Image Preview Component
 * Comprehensive image preview functionality with zoom, rotation, pan, and multi-image support
 * Alpine.js component for the S3 File Browser
 */

/**
 * Image Preview Alpine.js Component
 */
window.ImagePreviewComponent = function() {
    return {
        // Component State
        showImagePreview: false,
        currentImage: null,
        images: [],
        currentIndex: 0,
        currentBucket: null,
        isLoading: false,
        hasError: false,
        errorMessage: '',
        
        // Image Dimensions and Display
        imageDimensions: '',
        naturalWidth: 0,
        naturalHeight: 0,
        displayWidth: 0,
        displayHeight: 0,
        
        // Zoom State
        zoomLevel: 1,
        minZoom: 0.1,
        maxZoom: 10,
        zoomStep: 0.1,
        fitToScreenZoom: 1,
        
        // Rotation State
        rotation: 0,
        
        // Pan/Drag State
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        translateX: 0,
        translateY: 0,
        
        // Touch State
        isTouchDevice: false,
        touchStartDistance: 0,
        touchStartZoom: 1,
        lastTouchTime: 0,
        
        // Timeout references
        loadingTimeout: null,
        
        // Event handler references
        resizeHandler: null,
        fullscreenHandler: null,
        escapeHandler: null,
        keydownHandler: null,
        beforeUnloadHandler: null,
        
        // UI State
        showInfoPanel: false,
        showKeyboardHelp: false,
        isFullscreen: false,
        
        // Supported Image Formats
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'],
        
        // Performance and Memory Management
        objectUrls: new Map(),
        loadingImages: new Set(),
        
        /**
         * Initialize the image preview component
         */
        init() {
            this.setupEventListeners();
            this.detectTouchDevice();
            this.setupKeyboardShortcuts();
        },
        
        /**
         * Setup event listeners
         */
        setupEventListeners() {
            // Store bound handlers for cleanup
            this.resizeHandler = this.handleResize.bind(this);
            this.fullscreenHandler = this.handleFullscreenChange.bind(this);
            this.beforeUnloadHandler = this.cleanup.bind(this);
            this.escapeHandler = (e) => {
                if (e.key === 'Escape' && this.showImagePreview) {
                    this.closePreview();
                }
            };
            
            // Handle window resize
            window.addEventListener('resize', this.resizeHandler);
            
            // Handle fullscreen change
            document.addEventListener('fullscreenchange', this.fullscreenHandler);
            
            // Handle escape key for closing modal
            document.addEventListener('keydown', this.escapeHandler);
            
            // Cleanup on page unload
            window.addEventListener('beforeunload', this.beforeUnloadHandler);
            
            // Handle close button clicks with event delegation
            document.addEventListener('click', (e) => {
                if (e.target.closest('.close-preview-btn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closePreview();
                }
            });
        },
        
        /**
         * Detect if device supports touch
         */
        detectTouchDevice() {
            this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        },
        
        /**
         * Setup keyboard shortcuts
         */
        setupKeyboardShortcuts() {
            this.keydownHandler = (e) => {
                if (!this.showImagePreview) return;
                
                // Prevent default for our shortcuts
                switch(e.key.toLowerCase()) {
                    case '+':
                    case '=':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                    case '_':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.resetZoom();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.fitToScreen();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.rotateLeft();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.rotateRight();
                        break;
                    case 'arrowleft':
                        e.preventDefault();
                        this.previousImage();
                        break;
                    case 'arrowright':
                        e.preventDefault();
                        this.nextImage();
                        break;
                    case 'd':
                        e.preventDefault();
                        this.downloadImage();
                        break;
                    case 'i':
                        e.preventDefault();
                        this.toggleInfoPanel();
                        break;
                    case 'f11':
                        e.preventDefault();
                        this.toggleFullscreen();
                        break;
                    case '?':
                    case 'h':
                        e.preventDefault();
                        this.showKeyboardHelp = !this.showKeyboardHelp;
                        break;
                }
            };
            
            // Add keyboard event listener to document
            document.addEventListener('keydown', this.keydownHandler);
        },
        
        /**
         * Open image preview with single image
         */
        async openPreview(image) {
            await this.openPreviewWithImages([image], 0);
        },
        
        /**
         * Open image preview with multiple images
         */
        async openPreviewWithImages(images, startIndex = 0) {
            // Filter images to only supported formats
            this.images = images.filter(image => this.isImageSupported(image.name));
            this.currentIndex = Math.max(0, Math.min(startIndex, this.images.length - 1));
            
            if (this.images.length === 0) {
                this.showError('No supported image formats found');
                return;
            }
            
            // Reset modal DOM state in case it was forced hidden previously
            const modal = document.querySelector('.image-preview-modal');
            if (modal) {
                modal.style.removeProperty('display');
                modal.style.removeProperty('visibility');
                modal.style.removeProperty('opacity');
                modal.classList.remove('hidden');
                console.log('🔄 Modal DOM state reset for reopening');
            }
            
            this.showImagePreview = true;
            this.resetState();
            this.currentImage = this.images[this.currentIndex];
            await this.loadCurrentImage();
            
            // Focus the viewport for keyboard handling
            setTimeout(() => {
                const modal = document.querySelector('.image-preview-modal');
                if (modal) {
                    const viewport = modal.querySelector('.image-viewport');
                    if (viewport) {
                        viewport.focus();
                    }
                }
            }, 0);
        },
        
        /**
         * Reset component state
         */
        resetState() {
            this.zoomLevel = 1;
            this.rotation = 0;
            this.translateX = 0;
            this.translateY = 0;
            this.isDragging = false;
            this.hasError = false;
            this.errorMessage = '';
            this.imageDimensions = '';
        },
        
        /**
         * Load current image
         */
        async loadCurrentImage() {
            const image = this.currentImage;
            if (!image) {
                console.warn('No current image to load');
                return;
            }
            
            // Validate image has required properties
            if (!image.path || !image.name) {
                this.showError('Invalid image data: missing path or name');
                return;
            }
            
            // Check if already loading this image
            if (this.loadingImages.has(image.path)) {
                console.warn('Image already loading:', image.path);
                return;
            }
            
            this.isLoading = true;
            this.hasError = false;
            this.loadingImages.add(image.path);
            
            try {
                console.log('🖼️ Loading image:', image.path);
                
                // Load image URL using preview endpoint
                const imageUrl = await this.getImagePreviewUrl(image.path);
                
                console.log('🔗 Image URL obtained:', imageUrl);
                
                if (imageUrl) {
                    try {
                        // For streaming URLs, we need to fetch the data and create a blob URL
                        if (imageUrl.includes('/stream')) {
                            console.log('🔄 Fetching streaming image data...');
                            const response = await fetch(imageUrl);
                            
                            if (!response.ok) {
                                throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
                            }
                            
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            
                            // Store object URL for cleanup
                            const existingUrl = this.objectUrls.get(image.path);
                            if (existingUrl) {
                                try {
                                    URL.revokeObjectURL(existingUrl);
                                } catch (e) {
                                    console.warn('Failed to revoke existing URL:', e);
                                }
                            }
                            
                            this.objectUrls.set(image.path, blobUrl);
                            
                            // Update current image with blob URL
                            this.currentImage = { ...image, url: blobUrl };
                            
                            console.log('✅ Created blob URL for streaming image:', blobUrl);
                        } else {
                            // For direct URLs (presigned URLs), use them directly
                            const existingUrl = this.objectUrls.get(image.path);
                            if (existingUrl) {
                                try {
                                    URL.revokeObjectURL(existingUrl);
                                } catch (e) {
                                    console.warn('Failed to revoke existing URL:', e);
                                }
                            }
                            
                            this.objectUrls.set(image.path, imageUrl);
                            
                            // Update current image with URL
                            this.currentImage = { ...image, url: imageUrl };
                            
                            console.log('✅ Using direct URL for image:', imageUrl);
                        }
                        
                        console.log('✅ Updated current image with URL, waiting for load...');
                        
                        // Wait for image to load
                        await this.waitForImageLoad();
                        
                        console.log('✅ Image loaded successfully');
                    } catch (streamError) {
                        console.warn('❌ Streaming failed, trying fallback:', streamError);
                        
                        // Fallback: try to get a presigned URL instead
                        const fallbackUrl = await this.getFallbackImageUrl(image.path);
                        if (fallbackUrl) {
                            this.objectUrls.set(image.path, fallbackUrl);
                            this.currentImage = { ...image, url: fallbackUrl };
                            
                            console.log('✅ Using fallback URL:', fallbackUrl);
                            
                            // Wait for image to load
                            await this.waitForImageLoad();
                            console.log('✅ Image loaded successfully with fallback');
                        } else {
                            throw streamError; // Re-throw if fallback also fails
                        }
                    }
                } else {
                    throw new Error('Failed to load image URL');
                }
                
            } catch (error) {
                console.error('❌ Failed to load image:', error);
                const errorMessage = error.message || 'Unknown error occurred';
                this.showError(`Failed to load image: ${errorMessage}`);
            } finally {
                this.isLoading = false;
                this.loadingImages.delete(image.path);
            }
        },
        
        /**
         * Get image preview URL
         */
        async getImagePreviewUrl(imagePath) {
            try {
                const cleanPath = imagePath.replace(/^[/\\]+/, '');
                
                console.log('🔍 Getting image URL for path:', imagePath);
                console.log('🔍 Clean path:', cleanPath);
                
                // Use path segments to avoid encoding issues
                const pathSegments = cleanPath.split('/').map(segment => encodeURIComponent(segment));
                let streamUrl = `/api/v1/files/${pathSegments.join('/')}/stream`;
                
                if (this.currentBucket) {
                    streamUrl += `?bucket=${encodeURIComponent(this.currentBucket)}`;
                }
                
                console.log('🔍 Using stream URL:', streamUrl);
                
                // Directly use the stream URL - no need to check availability first
                // This avoids the double download issue
                return streamUrl;
                
            } catch (error) {
                console.error('❌ Error getting image URL:', error);
                throw error;
            }
        },

        /**
         * Get fallback image URL when streaming fails
         */
        async getFallbackImageUrl(imagePath) {
            try {
                const cleanPath = imagePath.replace(/^[/\\]+/, '');
                const encodedPath = encodeURIComponent(cleanPath);
                const bucketQuery = this.currentBucket ? `&bucket=${encodeURIComponent(this.currentBucket)}` : '';
                
                console.log('🔄 Getting fallback URL for path:', imagePath);
                
                // Try the download endpoint which returns a presigned URL
                const response = await fetch(`/api/v1/files/download?path=${encodedPath}${bucketQuery}`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.downloadUrl) {
                        console.log('✅ Got fallback URL:', data.data.downloadUrl);
                        return data.data.downloadUrl;
                    }
                }
                
                // Try the preview endpoint as another fallback
                const previewResponse = await fetch(`/api/v1/files/preview?path=${encodedPath}${bucketQuery}`);
                if (previewResponse.ok) {
                    const previewData = await previewResponse.json();
                    if (previewData.success && previewData.data?.previewUrl) {
                        console.log('✅ Got preview fallback URL:', previewData.data.previewUrl);
                        return previewData.data.previewUrl;
                    }
                }
                
                throw new Error('All fallback endpoints failed');
                
            } catch (error) {
                console.error('❌ Error getting fallback URL:', error);
                return null;
            }
        },
        
        /**
         * Wait for image to load
         */
        waitForImageLoad() {
            return new Promise((resolve, reject) => {
                // Wait for DOM to update with the new image source before checking
                this.$nextTick(() => {
                    // Find the image element in the modal context
                    const modal = document.querySelector('.image-preview-modal');
                    if (!modal) {
                        reject(new Error('Image preview modal not found'));
                        return;
                    }
                    
                    const imgElement = modal.querySelector('img[x-ref="imageElement"]');
                    if (!imgElement) {
                        reject(new Error('Image element not found'));
                        return;
                    }
                    
                    console.log('🖼️ waitForImageLoad() setup:', {
                        imgElementFound: !!imgElement,
                        currentSrc: imgElement.src,
                        expectedSrc: this.currentImage?.url,
                        imageName: this.currentImage?.name
                    });
                    
                    const handleLoad = () => {
                        console.log('✅ Image loaded successfully in waitForImageLoad');
                        this.onImageLoad();
                        resolve();
                    };
                    
                    const handleError = (event) => {
                        console.log('❌ Image failed to load in waitForImageLoad:', event);
                        this.onImageError(event);
                        reject(event);
                    };
                    
                    // Remove any existing listeners to prevent duplicates
                    imgElement.removeEventListener('load', handleLoad);
                    imgElement.removeEventListener('error', handleError);
                    
                    imgElement.addEventListener('load', handleLoad, { once: true });
                    imgElement.addEventListener('error', handleError, { once: true });
                    
                    // Set a timeout
                    const timeout = setTimeout(() => {
                        imgElement.removeEventListener('load', handleLoad);
                        imgElement.removeEventListener('error', handleError);
                        reject(new Error('Image loading timeout'));
                    }, 30000);
                    
                    // Store timeout reference for cleanup
                    this.loadingTimeout = timeout;
                    
                    // Clear timeout when loaded or errored
                    imgElement.addEventListener('load', () => clearTimeout(timeout), { once: true });
                    imgElement.addEventListener('error', () => clearTimeout(timeout), { once: true });
                });
            });
        },
        
        /**
         * Handle image load success
         */
        onImageLoad() {
            // Find the image element in the modal context
            const modal = document.querySelector('.image-preview-modal');
            if (!modal) return;
            
            const imgElement = modal.querySelector('img[x-ref="imageElement"]');
            if (!imgElement) return;
            
            // Clear any error state when image loads successfully
            this.hasError = false;
            this.errorMessage = '';
            this.isLoading = false;
            
            this.naturalWidth = imgElement.naturalWidth;
            this.naturalHeight = imgElement.naturalHeight;
            this.imageDimensions = `${this.naturalWidth} × ${this.naturalHeight}`;
            
            // Calculate fit to screen zoom
            this.calculateFitToScreenZoom();
            
            // Start with actual size (100% zoom) instead of fit to screen
            this.zoomLevel = 1;
            this.centerImage();
        },
        
        /**
         * Handle image load error
         */
        onImageError(event) {
            // Don't set error state if we're in the process of closing
            if (this.isClosing) {
                console.log('🚫 onImageError() called during close, ignoring...');
                return;
            }
            
            // Get the image element
            const imgElement = document.querySelector('img[x-ref="imageElement"]');
            
            // Add debugging info to understand the error source
            console.error('🚨 onImageError() called!', event);
            console.log('🔍 Debug info:', {
                currentImage: this.currentImage,
                imageUrl: this.currentImage?.url,
                imageSrc: imgElement?.src,
                hasError: this.hasError,
                errorMessage: this.errorMessage,
                isClosing: this.isClosing,
                isLoading: this.isLoading,
                naturalWidth: imgElement?.naturalWidth,
                naturalHeight: imgElement?.naturalHeight,
                complete: imgElement?.complete
            });
            
            // FIX: Ignore errors during initialization when no image is available
            if (!this.currentImage || !this.currentImage?.url) {
                console.log('🚫 Ignoring error during initialization - no valid image data');
                return;
            }
            
            // FIX: Ignore errors when src is empty or invalid
            if (!imgElement?.src || imgElement.src === '' || imgElement.src === window.location.href) {
                console.log('🚫 Ignoring spurious error - empty or invalid image source');
                return;
            }
            
            // FIX: Ignore errors when image has actually loaded successfully (naturalWidth > 0)
            if (imgElement?.naturalWidth && imgElement.naturalWidth > 0) {
                console.log('🚫 Ignoring error - image appears to have loaded successfully');
                return;
            }
            
            // FIX: Ignore errors during modal transitions
            if (!this.showImagePreview || !document.querySelector('.image-preview-modal:not(.hidden)')) {
                console.log('🚫 Ignoring error - modal is not visible');
                return;
            }
            
            // FIX: Only set error state for genuine image loading errors
            // Check if the error is from a network failure or invalid image
            if (event && (event.target === imgElement)) {
                // This is a genuine image loading error
                this.hasError = true;
                this.errorMessage = 'Failed to load image. The file may be corrupted, not supported, or the server is unreachable.';
                this.isLoading = false;
                console.log('🚨 Error state set:', {
                    hasError: this.hasError,
                    errorMessage: this.errorMessage,
                    isClosing: this.isClosing
                });
            } else {
                console.log('🚫 Ignoring non-image error event');
            }
        },
        
        /**
         * Calculate fit to screen zoom level
         */
        calculateFitToScreenZoom() {
            const modal = document.querySelector('.image-preview-modal');
            const viewport = modal ? modal.querySelector('.image-viewport') : null;
            if (!viewport || !this.naturalWidth || !this.naturalHeight) {
                this.fitToScreenZoom = 1;
                return;
            }
            
            const viewportRect = viewport.getBoundingClientRect();
            const padding = 40; // Account for padding and controls
            
            const widthRatio = (viewportRect.width - padding) / this.naturalWidth;
            const heightRatio = (viewportRect.height - padding) / this.naturalHeight;
            
            this.fitToScreenZoom = Math.min(widthRatio, heightRatio, 1);
        },
        
        /**
         * Show error message
         */
        showError(message) {
            this.hasError = true;
            this.errorMessage = message;
            this.isLoading = false;
        },
        
        /**
         * Update loading progress (for streaming)
         */
        updateLoadingProgress(progress) {
            // Could be used to show loading progress indicator
            console.log(`Loading progress: ${progress}%`);
        },
        
        /**
         * Check if image format is supported
         */
        isImageSupported(fileName) {
            if (!fileName) return false;
            const extension = fileName.split('.').pop()?.toLowerCase();
            return this.supportedFormats.includes(extension);
        },
        
        /**
         * Get file type from extension
         */
        getFileType(fileName) {
            if (!fileName) return 'Unknown';
            const extension = fileName.split('.').pop()?.toUpperCase();
            return extension || 'Unknown';
        },
        
        /**
         * Format file size
         */
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        /**
         * Format date
         */
        formatDate(dateString) {
            if (!dateString) return 'Unknown';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        /**
         * Get image transform style
         */
        getImageTransformStyle() {
            // Always apply centering offset to keep image centered at viewport center
            const baseTransform = `translate(-50%, -50%)`;
            const userTransform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoomLevel}) rotate(${this.rotation}deg)`;
            return {
                transform: `${baseTransform} ${userTransform}`,
                transition: this.isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transformOrigin: 'center center'
            };
        },
        
        /**
         * Zoom in
         */
        zoomIn() {
            const newZoom = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
            this.setZoom(newZoom, true);
        },
        
        /**
         * Zoom out
         */
        zoomOut() {
            const newZoom = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
            this.setZoom(newZoom, true);
        },
        
        /**
         * Reset zoom
         */
        resetZoom() {
            this.setZoom(1, true);
            this.centerImage();
        },
        
        /**
         * Fit to screen
         */
        fitToScreen() {
            this.calculateFitToScreenZoom();
            this.setZoom(this.fitToScreenZoom, true);
            this.centerImage();
        },
        
        /**
         * Set zoom level
         */
        setZoom(level, animate = false) {
            const oldZoom = this.zoomLevel;
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
            
            // Adjust position to zoom towards center
            if (!animate && oldZoom !== this.zoomLevel) {
                const scaleFactor = this.zoomLevel / oldZoom;
                this.translateX *= scaleFactor;
                this.translateY *= scaleFactor;
            }
        },
        
        /**
         * Center image
         */
        centerImage() {
            this.translateX = 0;
            this.translateY = 0;
        },
        
        /**
         * Rotate left
         */
        rotateLeft() {
            this.rotation = (this.rotation - 90) % 360;
        },
        
        /**
         * Rotate right
         */
        rotateRight() {
            this.rotation = (this.rotation + 90) % 360;
        },
        
        /**
         * Handle mouse wheel for zooming
         */
        handleWheel(event) {
            event.preventDefault();
            
            const delta = event.deltaY > 0 ? -this.zoomStep : this.zoomStep;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
            
            // Get mouse position relative to viewport
            const modal = document.querySelector('.image-preview-modal');
            const viewport = modal ? modal.querySelector('.image-viewport') : null;
            if (!viewport) return;
            
            const rect = viewport.getBoundingClientRect();
            const mouseX = event.clientX - rect.left - rect.width / 2;
            const mouseY = event.clientY - rect.top - rect.height / 2;
            
            // Adjust translation to zoom towards mouse position
            const zoomRatio = newZoom / this.zoomLevel;
            this.translateX = mouseX - (mouseX - this.translateX) * zoomRatio;
            this.translateY = mouseY - (mouseY - this.translateY) * zoomRatio;
            
            this.setZoom(newZoom);
        },
        
        /**
         * Start drag
         */
        startDrag(event) {
            // Only start drag if not at minimum zoom (when image fits screen)
            if (this.zoomLevel <= this.fitToScreenZoom) return;
            
            this.isDragging = true;
            this.dragStartX = event.clientX - this.translateX;
            this.dragStartY = event.clientY - this.translateY;
            
            // Change cursor
            const modal = document.querySelector('.image-preview-modal');
            const viewport = modal ? modal.querySelector('.image-viewport') : null;
            if (viewport) {
                viewport.classList.add('panning');
            }
        },
        
        /**
         * Handle drag
         */
        drag(event) {
            if (!this.isDragging) return;
            
            event.preventDefault();
            this.translateX = event.clientX - this.dragStartX;
            this.translateY = event.clientY - this.dragStartY;
        },
        
        /**
         * End drag
         */
        endDrag() {
            this.isDragging = false;
            
            // Restore cursor
            const modal = document.querySelector('.image-preview-modal');
            const viewport = modal ? modal.querySelector('.image-viewport') : null;
            if (viewport) {
                viewport.classList.remove('panning');
            }
        },
        
        /**
         * Handle touch start
         */
        startTouch(event) {
            if (event.touches.length === 1) {
                // Single touch - potential drag
                const touch = event.touches[0];
                this.startDrag({ clientX: touch.clientX, clientY: touch.clientY });
            } else if (event.touches.length === 2) {
                // Two fingers - pinch zoom
                this.endDrag();
                
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                
                const distance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                this.touchStartDistance = distance;
                this.touchStartZoom = this.zoomLevel;
            }
            
            // Detect double tap
            const currentTime = Date.now();
            if (currentTime - this.lastTouchTime < 300) {
                this.handleDoubleTap();
            }
            this.lastTouchTime = currentTime;
        },
        
        /**
         * Handle touch move
         */
        handleTouch(event) {
            event.preventDefault();
            
            if (event.touches.length === 1) {
                // Single touch - drag
                const touch = event.touches[0];
                this.drag({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
            } else if (event.touches.length === 2) {
                // Two fingers - pinch zoom
                const touch1 = event.touches[0];
                const touch2 = event.touches[1];
                
                const distance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                const scale = distance / this.touchStartDistance;
                const newZoom = this.touchStartZoom * scale;
                
                this.setZoom(Math.max(this.minZoom, Math.min(this.maxZoom, newZoom)));
            }
        },
        
        /**
         * End touch
         */
        endTouch() {
            this.endDrag();
            this.touchStartDistance = 0;
        },
        
        /**
         * Handle double tap
         */
        handleDoubleTap() {
            // Toggle between fit to screen and actual size
            if (Math.abs(this.zoomLevel - this.fitToScreenZoom) < 0.01) {
                this.setZoom(1);
                this.centerImage();
            } else {
                this.fitToScreen();
            }
        },
        
        /**
         * Navigate to previous image
         */
        async previousImage() {
            if (this.hasPreviousImage) {
                this.currentIndex--;
                this.resetState();
                this.currentImage = this.images[this.currentIndex];
                await this.loadCurrentImage();
            }
        },
        
        /**
         * Navigate to next image
         */
        async nextImage() {
            if (this.hasNextImage) {
                this.currentIndex++;
                this.resetState();
                this.currentImage = this.images[this.currentIndex];
                await this.loadCurrentImage();
            }
        },
        
        /**
         * Download current image
         */
        async downloadImage() {
            if (!this.currentImage) return;
            
            try {
                if (window.fileBrowserApp && window.fileBrowserApp.downloadItem) {
                    await window.fileBrowserApp.downloadItem(this.currentImage);
                } else if (window.DownloadHelper) {
                    await window.DownloadHelper.downloadFile(
                        this.currentImage.path,
                        null,
                        {
                            fileName: this.currentImage.name,
                            fileSize: this.currentImage.size || 0
                        }
                    );
                } else {
                    // Fallback - create download link
                    const link = document.createElement('a');
                    link.href = this.currentImage.url;
                    link.download = this.currentImage.name;
                    link.target = '_blank';
                    link.click();
                }
                
                this.showNotification('Download started', 'info');
            } catch (error) {
                console.error('Failed to download image:', error);
                this.showNotification('Failed to download image', 'error');
            }
        },
        
        /**
         * Open image in new tab
         */
        openInNewTab() {
            if (!this.currentImage?.url) return;
            
            const link = document.createElement('a');
            link.href = this.currentImage.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
        },
        
        /**
         * Toggle info panel
         */
        toggleInfoPanel() {
            this.showInfoPanel = !this.showInfoPanel;
        },
        
        /**
         * Toggle fullscreen
         */
        toggleFullscreen() {
            if (!document.fullscreenElement) {
                const modal = document.querySelector('.image-preview-modal');
                if (modal) {
                    modal.requestFullscreen().catch(err => {
                        console.error('Failed to enter fullscreen:', err);
                        this.showNotification('Failed to enter fullscreen', 'error');
                    });
                }
            } else {
                document.exitFullscreen();
            }
        },
        
        /**
         * Handle fullscreen change
         */
        handleFullscreenChange() {
            this.isFullscreen = !!document.fullscreenElement;
            
            // Recalculate fit to screen when entering/exiting fullscreen
            if (this.currentImage) {
                setTimeout(() => {
                    this.calculateFitToScreenZoom();
                    if (this.zoomLevel <= this.fitToScreenZoom) {
                        this.fitToScreen();
                    }
                }, 0);
            }
        },
        
        /**
         * Handle window resize
         */
        handleResize() {
            if (this.currentImage) {
                setTimeout(() => {
                    this.calculateFitToScreenZoom();
                    if (this.zoomLevel <= this.fitToScreenZoom) {
                        this.fitToScreen();
                    }
                }, 0);
            }
        },
        
        /**
         * Retry loading image
         */
        async retryLoad() {
            this.hasError = false;
            this.errorMessage = '';
            await this.loadCurrentImage();
        },
        
        /**
         * Close preview
         */
        closePreview() {
            console.log('🔄 Closing image preview...');
            
            // Prevent multiple close calls
            if (this.isClosing) {
                console.log('⚠️ Already closing, ignoring duplicate call');
                return;
            }
            
            this.isClosing = true;
            
            // STEP 1: Hide modal immediately
            console.log('🔄 STEP 1: Hiding modal...');
            if (window.fileBrowserApp) {
                window.fileBrowserApp.showImagePreview = false;
            }
            this.showImagePreview = false;
            
            // STEP 2: Clear error state immediately to prevent error callbacks
            this.hasError = false;
            this.errorMessage = '';
            this.isLoading = false;
            
            // STEP 3: Safely clean up image element
            const imgElement = document.querySelector('img[x-ref="imageElement"]');
            if (imgElement) {
                console.log('🛡️ STEP 3: Safely cleaning image element');
                
                // Clone the element to remove all event listeners
                const newImg = imgElement.cloneNode(false);
                
                // Clear src to stop any loading
                newImg.removeAttribute('src');
                newImg.src = '';
                
                // Replace the old element with the clean clone
                if (imgElement.parentNode) {
                    imgElement.parentNode.replaceChild(newImg, imgElement);
                }
                
                console.log('✅ Image element cleaned and replaced');
            }
            
            // STEP 4: Clear all other states
            this.currentImage = null;
            this.images = [];
            this.currentIndex = 0;
            
            // STEP 5: Reset zoom and transform states
            this.resetState();
            
            // STEP 6: Force modal hidden if Alpine.js doesn't hide it properly
            setTimeout(() => {
                const modal = document.querySelector('.image-preview-modal');
                if (modal && modal.offsetParent !== null) {
                    console.log('⚠️ Alpine.js failed to hide modal, forcing with DOM manipulation');
                    this.forceHideModal();
                }
            }, 200);
            
            // STEP 7: Cleanup resources
            this.cleanup();
            
            // Reset closing flag after a short delay
            setTimeout(() => {
                this.isClosing = false;
                console.log('✅ Image preview closed successfully');
            }, 100);
        },
        
        /**
         * Force hide modal with DOM manipulation
         */
        forceHideModal() {
            const modal = document.querySelector('.image-preview-modal');
            if (modal) {
                // Force hide using multiple methods
                modal.style.display = 'none';
                modal.style.visibility = 'hidden';
                modal.style.opacity = '0';
                modal.classList.add('hidden');
                
                // Also hide the overlay
                const overlay = document.querySelector('.image-preview-overlay');
                if (overlay) {
                    overlay.style.display = 'none';
                    overlay.style.visibility = 'hidden';
                    overlay.style.opacity = '0';
                }
                
                console.log('🔒 Modal forced hidden permanently (styles will be reset on reopen)');
            }
        },

        /**
         * Show notification
         */
        showNotification(message, type = 'info') {
            if (window.fileBrowserApp && typeof window.fileBrowserApp.showNotification === 'function') {
                window.fileBrowserApp.showNotification(message, type);
            } else {
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        },
        
        /**
         * Cleanup resources
         */
        cleanup() {
            // Revoke object URLs to free memory
            for (const [path, url] of this.objectUrls.entries()) {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    console.warn('Failed to revoke object URL:', e);
                }
            }
            this.objectUrls.clear();
            
            // Clear any pending timeouts
            if (this.loadingTimeout) {
                clearTimeout(this.loadingTimeout);
                this.loadingTimeout = null;
            }
            
            // Remove event listeners
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
            }
            if (this.fullscreenHandler) {
                document.removeEventListener('fullscreenchange', this.fullscreenHandler);
            }
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
            }
            if (this.keydownHandler) {
                document.removeEventListener('keydown', this.keydownHandler);
            }
            if (this.beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            }
            
            // Reset state
            this.currentImage = null;
            this.images = [];
            this.currentIndex = 0;
            this.resetState();
        },
        
        /**
         * Computed Properties
         */
        get hasMultipleImages() {
            return this.images.length > 1;
        },
        
        get totalImages() {
            return this.images.length;
        },
        
        get hasPreviousImage() {
            return this.currentIndex > 0;
        },
        
        get hasNextImage() {
            return this.currentIndex < this.images.length - 1;
        },
        
        get zoomPercentage() {
            return Math.round(this.zoomLevel * 100);
        },
        
        get canZoomIn() {
            return this.zoomLevel < this.maxZoom;
        },
        
        get canZoomOut() {
            return this.zoomLevel > this.minZoom;
        },
        
        get isAtActualSize() {
            return Math.abs(this.zoomLevel - 1) < 0.01;
        },
        
        get isFittedToScreen() {
            return Math.abs(this.zoomLevel - this.fitToScreenZoom) < 0.01;
        }
    };
};

// Register the component for Alpine.js x-data reference
window.imagePreviewComponent = window.ImagePreviewComponent;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ImagePreviewComponent;
}
