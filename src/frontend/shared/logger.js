/**
 * Logger Utility - JavaScript version
 * Provides logging functionality for the application
 */

(function() {
    'use strict';

    // Logger object
    window.Logger = {
        debug: function(message, data, context) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] ${message}`, data || '');
            }
        },
        info: function(message, data, context) {
            console.info(`[INFO] ${message}`, data || '');
        },
        warn: function(message, data, context) {
            console.warn(`[WARN] ${message}`, data || '');
        },
        error: function(message, error, context) {
            console.error(`[ERROR] ${message}`, error || '');
        },
        uploadProgress: function(fileName, progress, transferId) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] Upload progress: ${fileName} - ${progress.toFixed(1)}%`);
            }
        },
        downloadProgress: function(fileName, progress, downloadId) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] Download progress: ${fileName} - ${progress.toFixed(1)}%`);
            }
        },
        image: function(operation, details) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] Image ${operation}`, details);
            }
        },
        network: function(quality, speed, details) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] Network quality: ${quality}`, { speed, ...details });
            }
        },
        performance: function(operation, duration, details) {
            if (window.SHARED_CONFIG?.DEBUG) {
                console.log(`[DEBUG] Performance: ${operation} completed in ${duration}ms`, details);
            }
        }
    };

    console.log('✅ Logger loaded');
})();