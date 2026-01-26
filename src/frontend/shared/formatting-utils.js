/**
 * Formatting Utils - JavaScript version
 * Provides formatting utilities for the application
 */

(function() {
    'use strict';

    // FormattingUtils object
    window.FormattingUtils = {
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        formatTime: function(seconds) {
            if (!seconds || seconds < 0) return '—';
            if (seconds < 60) return Math.round(seconds) + 's';
            if (seconds < 3600) return Math.round(seconds / 60) + 'm';
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.round((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        },

        formatSpeed: function(bytesPerSecond) {
            if (!bytesPerSecond) return '—';
            return this.formatFileSize(bytesPerSecond) + '/s';
        },

        formatPercentage: function(value, total) {
            if (!total || total === 0) return '0%';
            return ((value / total) * 100).toFixed(1) + '%';
        },

        formatNumber: function(num, decimals = 0) {
            if (num === null || num === undefined) return '—';
            return Number(num).toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        formatCurrency: function(amount, currency = 'USD') {
            if (amount === null || amount === undefined) return '—';
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currency
            }).format(amount);
        },

        formatDate: function(date, options = {}) {
            if (!date) return '—';
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) return '—';
            
            const defaultOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            
            return dateObj.toLocaleDateString(undefined, { ...defaultOptions, ...options });
        },

        formatRelativeTime: function(date) {
            if (!date) return '—';
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) return '—';
            
            const now = new Date();
            const diffMs = now - dateObj;
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffSecs < 60) return 'just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            
            return this.formatDate(dateObj);
        },

        formatDuration: function(milliseconds) {
            if (!milliseconds || milliseconds < 0) return '—';
            
            const seconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        },

        truncateText: function(text, maxLength = 50, suffix = '...') {
            if (!text) return '';
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength - suffix.length) + suffix;
        },

        capitalizeFirst: function(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },

        camelCase: function(str) {
            if (!str) return '';
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, '');
        },

        kebabCase: function(str) {
            if (!str) return '';
            return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').toLowerCase();
        },

        slugify: function(str) {
            if (!str) return '';
            return str
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[\s_-]+/g, '-')
                .replace(/^-+|-+$/g, '');
        },

        formatBytes: function(bytes, precision = 2) {
            if (bytes === 0) return '0 B';
            const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
            const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
            const value = bytes / Math.pow(1024, unitIndex);
            return `${value.toFixed(precision)} ${units[unitIndex]}`;
        },

        formatBandwidth: function(bytesPerSecond) {
            return this.formatSpeed(bytesPerSecond);
        },

        formatTransferRate: function(bytesTransferred, timeElapsed) {
            if (!timeElapsed || timeElapsed === 0) return '—';
            const rate = bytesTransferred / timeElapsed;
            return this.formatSpeed(rate);
        }
    };

    console.log('✅ FormattingUtils loaded');
})();