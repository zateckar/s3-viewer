/**
 * S3 Image Preview Component using PhotoViewer Library
 * Replaces the complex 1,400+ line vanilla implementation with a clean wrapper
 */
class S3ImagePreview {
    constructor() {
        this.currentBucket = null;
        this.viewer = null;
    }
    
    /**
     * Open image preview with single image
     */
    async openPreview(image) {
        await this.openPreviewWithImages([image], 0);
    }
    
    /**
     * Open image preview with multiple images
     */
    async openPreviewWithImages(images, startIndex = 0) {
        try {
            // Filter supported image formats
            const supportedImages = images.filter(img => this.isImageSupported(img.name));
            
            if (supportedImages.length === 0) {
                window.fileBrowserApp?.notify('No supported image formats found', 'warning');
                return;
            }
            
            // Prepare photo items for PhotoViewer
            const photoItems = await Promise.all(
                supportedImages.map(async (img, index) => {
                    try {
                        // Convert image to data URL to handle authentication
                        const dataUrl = await this.convertImageToDataUrl(img.path);
                        const downloadUrl = await this.getDownloadUrl(img.path);
                        
                        return {
                            src: dataUrl,
                            title: img.name,
                            thumb: dataUrl, // Use data URL for thumbnail
                            // Custom metadata for download functionality
                            fileName: img.name,
                            fileSize: img.size,
                            path: img.path,
                            downloadUrl: downloadUrl,
                            originalUrl: await this.getImageUrl(img.path) // Keep original for reference
                        };
                    } catch (error) {
                        console.warn(`Failed to prepare image ${img.name}:`, error);
                        return null;
                    }
                })
            );
            
            // Filter out null items (failed to load)
            const validPhotoItems = photoItems.filter(item => item !== null);
            
            if (validPhotoItems.length === 0) {
                window.fileBrowserApp?.notify('Failed to load any images', 'error');
                return;
            }
            
            // Clean up existing viewer
            if (this.viewer) {
                try {
                    this.viewer.close();
                } catch (e) {
                    console.warn('Failed to close existing viewer:', e);
                }
                this.viewer = null;
            }
            
            // Initialize PhotoViewer with S3 images
            this.viewer = new PhotoViewer(validPhotoItems, {
                index: Math.min(startIndex, validPhotoItems.length - 1),
                
                // Modal options
                modalOptions: {
                    backdrop: 'rgba(0, 0, 0, 0.9)',
                    keyboard: true,
                    movable: true,
                    zoomable: true,
                    rotatable: false, // Rotation not needed for S3 viewer
                    transition: true,
                    className: 's3-photoviewer'
                },
                
                // Toolbar configuration
                toolbar: {
                    zoomIn: true,
                    zoomOut: true,
                    reset: true,
                    prev: validPhotoItems.length > 1,
                    next: validPhotoItems.length > 1,
                    rotateLeft: false,
                    rotateRight: false,
                    flipHorizontal: false,
                    flipVertical: false,
                    fullscreen: true,
                    closeButton: true,
                    download: true
                },
                
                // Custom download handler for S3 URLs
                customToolbar: {
                    download: {
                        click: (e, index, photoData) => {
                            this.downloadFromS3(photoData[index]);
                        }
                    }
                },
                
                // Event handlers
                init: () => {
                    console.log('PhotoViewer initialized');
                },
                opened: (index, photoData) => {
                    console.log(`Opened image: ${photoData[index].title}`);
                },
                closed: () => {
                    console.log('PhotoViewer closed');
                    this.viewer = null;
                },
                destroyed: () => {
                    console.log('PhotoViewer destroyed');
                    this.viewer = null;
                }
            });
            
        } catch (error) {
            console.error('Failed to open image preview:', error);
            window.fileBrowserApp?.notify('Failed to open image preview', 'error');
        }
    }
    
    /**
     * Convert image to data URL with authentication
     */
    async convertImageToDataUrl(imagePath) {
        try {
            const imageUrl = await this.getImageUrl(imagePath);
            
            const response = await fetch(imageUrl, {
                headers: { ...window.Auth?.getAuthHeader() }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to convert image to data URL:', error);
            throw error;
        }
    }
    
    /**
     * Get image URL for preview
     */
    async getImageUrl(imagePath) {
        const cleanPath = imagePath.replace(/^[/\\]+/, '');
        const pathSegments = cleanPath.split('/').map(segment => encodeURIComponent(segment));
        let streamUrl = `/api/v1/files/${pathSegments.join('/')}/stream`;
        
        if (this.currentBucket) {
            streamUrl += `?bucket=${encodeURIComponent(this.currentBucket)}`;
        }
        
        return streamUrl;
    }
    
    /**
     * Get download URL for image
     */
    async getDownloadUrl(imagePath) {
        try {
            const cleanPath = imagePath.replace(/^[/\\]+/, '');
            const encodedPath = encodeURIComponent(cleanPath);
            const bucketQuery = this.currentBucket ? `&bucket=${encodeURIComponent(this.currentBucket)}` : '';
            
            const response = await fetch(`/api/v1/files/download?path=${encodedPath}${bucketQuery}`, {
                headers: { ...window.Auth?.getAuthHeader() }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.success ? data.data.downloadUrl : null;
            }
        } catch (error) {
            console.warn('Failed to get download URL:', error);
        }
        return null;
    }
    
    /**
     * Download image from S3
     */
    downloadFromS3(photoData) {
        try {
            if (photoData.downloadUrl) {
                const link = document.createElement('a');
                link.href = photoData.downloadUrl;
                link.download = photoData.fileName || 'download';
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                window.fileBrowserApp?.notify(`Download started: ${photoData.fileName}`, 'info');
            } else {
                // Fallback to stream URL
                const link = document.createElement('a');
                link.href = photoData.src;
                link.download = photoData.fileName || 'download';
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                window.fileBrowserApp?.notify(`Download started: ${photoData.fileName}`, 'info');
            }
        } catch (error) {
            console.error('Failed to download image:', error);
            window.fileBrowserApp?.notify('Failed to download image', 'error');
        }
    }
    
    /**
     * Check if image format is supported
     */
    isImageSupported(fileName) {
        if (!fileName) return false;
        const extension = fileName.split('.').pop()?.toLowerCase();
        const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
        return supportedFormats.includes(extension);
    }
    
    /**
     * Close current viewer
     */
    close() {
        if (this.viewer) {
            try {
                this.viewer.close();
            } catch (error) {
                console.warn('Failed to close viewer:', error);
                this.viewer = null;
            }
        }
    }
    
    /**
     * Destroy current viewer
     */
    destroy() {
        if (this.viewer) {
            try {
                this.viewer.close();
            } catch (error) {
                console.warn('Failed to destroy viewer:', error);
            }
            this.viewer = null;
        }
    }
}

// Create and export singleton instance
window.ImagePreviewVanilla = new S3ImagePreview();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ImagePreviewVanilla;
}