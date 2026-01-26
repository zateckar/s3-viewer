/**
 * Input Validation and Sanitization System
 * Provides comprehensive validation for all user inputs with security checks
 */

import { INPUT_CONSTANTS, FILE_TYPE_CONSTANTS, FILE_CONSTANTS } from './constants';
import { Logger } from './logger';
import { ErrorFactory, ErrorCode } from './error-system';

// Validation rule types
export interface ValidationRule {
    name: string;
    required?: boolean;
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    allowedValues?: any[];
    sanitize?: boolean;
    trim?: boolean;
    custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitized: any;
}

export interface FileValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitized: {
        name: string;
        size: number;
        type: string;
        category: string;
    };
}

/**
 * InputValidator class
 * Centralized validation and sanitization for all user inputs
 */
export class InputValidator {
    private static instance: InputValidator;

    private constructor() {}

    public static getInstance(): InputValidator {
        if (!InputValidator.instance) {
            InputValidator.instance = new InputValidator();
        }
        return InputValidator.instance;
    }

    /**
     * Sanitizes a string input
     */
    public sanitizeString(input: string, options: {
        maxLength?: number;
        allowHTML?: boolean;
        trim?: boolean;
        lowercase?: boolean;
    } = {}): string {
        if (typeof input !== 'string') {
            return '';
        }

        let sanitized = input;

        // Trim whitespace
        if (options.trim !== false) {
            sanitized = sanitized.trim();
        }

        // Limit length
        if (options.maxLength && sanitized.length > options.maxLength) {
            sanitized = sanitized.substring(0, options.maxLength);
        }

        // Convert to lowercase
        if (options.lowercase) {
            sanitized = sanitized.toLowerCase();
        }

        // Remove/escape HTML unless allowed
        if (!options.allowHTML) {
            sanitized = this.escapeHTML(sanitized);
        }

        // Remove null bytes and other dangerous characters
        sanitized = sanitized.replace(/\0/g, '');
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        return sanitized;
    }

    /**
     * Sanitizes a file name
     */
    public sanitizeFileName(fileName: string): string {
        if (typeof fileName !== 'string') {
            return '';
        }

        // Remove path separators and dangerous characters
        let sanitized = fileName.replace(/[\\/:"*?<>|]/g, '');
        
        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
        
        // Trim and limit length
        sanitized = sanitized.trim();
        if (sanitized.length > INPUT_CONSTANTS.MAX_FILENAME_LENGTH) {
            const extension = sanitized.substring(sanitized.lastIndexOf('.'));
            const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
            const maxNameLength = INPUT_CONSTANTS.MAX_FILENAME_LENGTH - extension.length;
            sanitized = nameWithoutExt.substring(0, maxNameLength) + extension;
        }

        // Ensure it's not empty
        if (sanitized === '') {
            sanitized = 'unnamed_file';
        }

        return sanitized;
    }

    /**
     * Sanitizes a path
     */
    public sanitizePath(path: string): string {
        if (typeof path !== 'string') {
            return '';
        }

        // Normalize path separators
        let sanitized = path.replace(/\\/g, '/');
        
        // Remove dangerous patterns
        sanitized = sanitized.replace(/\.\./g, '');
        sanitized = sanitized.replace(/\/+/g, '/');
        
        // Remove leading/trailing slashes
        sanitized = sanitized.replace(/^\/+|\/+$/g, '');
        
        // Limit length
        if (sanitized.length > INPUT_CONSTANTS.MAX_PATH_LENGTH) {
            sanitized = sanitized.substring(0, INPUT_CONSTANTS.MAX_PATH_LENGTH);
        }

        return sanitized;
    }

    /**
     * Validates an email address
     */
    public validateEmail(email: string): { isValid: boolean; sanitized: string } {
        if (typeof email !== 'string') {
            return { isValid: false, sanitized: '' };
        }

        const sanitized = this.sanitizeString(email.toLowerCase().trim());
        
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        return {
            isValid: emailRegex.test(sanitized) && sanitized.length <= INPUT_CONSTANTS.MAX_EMAIL_LENGTH,
            sanitized
        };
    }

    /**
     * Validates an object against a schema
     */
    public validateObject(data: any, schema: Record<string, ValidationRule>): ValidationResult {
        const errors: string[] = [];
        const sanitized: any = {};

        for (const [fieldName, rule] of Object.entries(schema)) {
            const value = data?.[fieldName];
            let fieldValue = value;

            // Check required fields
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push(`${fieldName} is required`);
                continue;
            }

            // Skip validation if field is not provided and not required
            if (value === undefined || value === null || value === '') {
                if (!rule.required) {
                    sanitized[fieldName] = value;
                }
                continue;
            }

            // Type validation
            if (rule.type && typeof value !== rule.type) {
                errors.push(`${fieldName} must be of type ${rule.type}`);
                continue;
            }

            // String validation
            if (rule.type === 'string') {
                fieldValue = this.sanitizeString(value, {
                    maxLength: rule.maxLength,
                    trim: rule.trim
                });

                if (rule.minLength && fieldValue.length < rule.minLength) {
                    errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
                    continue;
                }

                if (rule.maxLength && fieldValue.length > rule.maxLength) {
                    errors.push(`${fieldName} must be no more than ${rule.maxLength} characters long`);
                    continue;
                }

                if (rule.pattern && !rule.pattern.test(fieldValue)) {
                    errors.push(`${fieldName} format is invalid`);
                    continue;
                }
            }

            // Number validation
            if (rule.type === 'number') {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    errors.push(`${fieldName} must be a valid number`);
                    continue;
                }

                if (rule.min !== undefined && numValue < rule.min) {
                    errors.push(`${fieldName} must be at least ${rule.min}`);
                    continue;
                }

                if (rule.max !== undefined && numValue > rule.max) {
                    errors.push(`${fieldName} must be no more than ${rule.max}`);
                    continue;
                }

                fieldValue = numValue;
            }

            // Array validation
            if (rule.type === 'array') {
                if (!Array.isArray(value)) {
                    errors.push(`${fieldName} must be an array`);
                    continue;
                }

                if (rule.minLength && value.length < rule.minLength) {
                    errors.push(`${fieldName} must have at least ${rule.minLength} items`);
                    continue;
                }

                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push(`${fieldName} must have no more than ${rule.maxLength} items`);
                    continue;
                }
            }

            // Allowed values validation
            if (rule.allowedValues && !rule.allowedValues.includes(fieldValue)) {
                errors.push(`${fieldName} must be one of: ${rule.allowedValues.join(', ')}`);
                continue;
            }

            // Custom validation
            if (rule.custom) {
                const customResult = rule.custom(fieldValue);
                if (customResult !== true) {
                    errors.push(typeof customResult === 'string' ? customResult : `${fieldName} failed custom validation`);
                    continue;
                }
            }

            sanitized[fieldName] = fieldValue;
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized
        };
    }

    /**
     * Validates a file for upload
     */
    public validateFile(file: File): FileValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check file size
        if (file.size > FILE_CONSTANTS.MAX_FILE_SIZE) {
            errors.push(`File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(FILE_CONSTANTS.MAX_FILE_SIZE)})`);
        }

        if (file.size === 0) {
            errors.push('File is empty');
        }

        // Check file name
        const sanitizedName = this.sanitizeFileName(file.name);
        if (sanitizedName !== file.name) {
            warnings.push('File name has been sanitized for security');
        }

        if (sanitizedName.length === 0) {
            errors.push('File name is invalid after sanitization');
        }

        // Check file extension
        const extension = this.getFileExtension(sanitizedName).toLowerCase();
        const category = this.getFileCategory(extension);

        // Additional checks for images
        if (category === 'image') {
            if (file.size > FILE_CONSTANTS.MAX_IMAGE_SIZE) {
                errors.push(`Image file size exceeds maximum allowed size (${this.formatFileSize(FILE_CONSTANTS.MAX_IMAGE_SIZE)})`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitized: {
                name: sanitizedName,
                size: file.size,
                type: file.type,
                category
            }
        };
    }

    /**
     * Validates a bucket name
     */
    public validateBucketName(bucketName: string): { isValid: boolean; error?: string; sanitized: string } {
        if (typeof bucketName !== 'string') {
            return { isValid: false, error: 'Bucket name must be a string', sanitized: '' };
        }

        const sanitized = this.sanitizeString(bucketName.trim().toLowerCase());

        // Bucket name validation rules (S3 compliant)
        const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
        
        if (!bucketNameRegex.test(sanitized)) {
            return {
                isValid: false,
                error: 'Bucket name must be 3-63 characters long, contain only lowercase letters, numbers, dots, and hyphens, and start and end with a letter or number',
                sanitized
            };
        }

        // Additional checks
        if (sanitized.includes('..')) {
            return { isValid: false, error: 'Bucket name cannot contain consecutive dots', sanitized };
        }

        if (sanitized.startsWith('-') || sanitized.endsWith('-')) {
            return { isValid: false, error: 'Bucket name cannot start or end with a hyphen', sanitized };
        }

        if (sanitized.startsWith('.') || sanitized.endsWith('.')) {
            return { isValid: false, error: 'Bucket name cannot start or end with a dot', sanitized };
        }

        return { isValid: true, sanitized };
    }

    /**
     * Validates a S3 path/prefix
     */
    public validateS3Path(prefix: string): { isValid: boolean; error?: string; sanitized: string } {
        if (typeof prefix !== 'string') {
            return { isValid: false, error: 'Path must be a string', sanitized: '' };
        }

        const sanitized = this.sanitizePath(prefix);

        // Check for invalid patterns
        if (sanitized.includes('..')) {
            return { isValid: false, error: 'Path cannot contain parent directory references', sanitized };
        }

        // Check length
        if (sanitized.length > INPUT_CONSTANTS.MAX_PATH_LENGTH) {
            return { isValid: false, error: 'Path is too long', sanitized };
        }

        return { isValid: true, sanitized };
    }

    /**
     * Escapes HTML characters in a string
     */
    private escapeHTML(str: string): string {
        const htmlEscapes: Record<string, string> = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
    }

    /**
     * Gets file extension from filename
     */
    private getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot > -1 ? fileName.substring(lastDot + 1) : '';
    }

    /**
     * Gets file category based on extension
     */
    private getFileCategory(extension: string): string {
        if (FILE_TYPE_CONSTANTS.SUPPORTED_IMAGE_FORMATS.includes(extension.toLowerCase())) {
            return 'image';
        }
        
        // Add more categories as needed
        const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'rtf'];
        const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv'];
        const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg'];
        const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];

        if (documentTypes.includes(extension.toLowerCase())) return 'document';
        if (videoTypes.includes(extension.toLowerCase())) return 'video';
        if (audioTypes.includes(extension.toLowerCase())) return 'audio';
        if (archiveTypes.includes(extension.toLowerCase())) return 'archive';
        
        return 'other';
    }

    /**
     * Formats file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export singleton instance
export const InputValidatorInstance = InputValidator.getInstance();

// Export validation schemas for common use cases
export const ValidationSchemas = {
    // Upload request validation
    uploadRequest: {
        fileName: {
            name: 'fileName',
            required: true,
            type: 'string',
            minLength: 1,
            maxLength: INPUT_CONSTANTS.MAX_FILENAME_LENGTH,
            sanitize: true,
            trim: true
        },
        bucketName: {
            name: 'bucketName',
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 63,
            pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
            sanitize: true,
            trim: true
        },
        prefix: {
            name: 'prefix',
            required: false,
            type: 'string',
            maxLength: INPUT_CONSTANTS.MAX_PATH_LENGTH,
            sanitize: true,
            trim: true
        },
        chunkSize: {
            name: 'chunkSize',
            required: false,
            type: 'number',
            min: FILE_CONSTANTS.MIN_CHUNK_SIZE,
            max: FILE_CONSTANTS.MAX_CHUNK_SIZE
        }
    },

    // Download request validation
    downloadRequest: {
        fileName: {
            name: 'fileName',
            required: true,
            type: 'string',
            minLength: 1,
            maxLength: INPUT_CONSTANTS.MAX_FILENAME_LENGTH,
            sanitize: true,
            trim: true
        },
        bucketName: {
            name: 'bucketName',
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 63,
            pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
            sanitize: true,
            trim: true
        },
        prefix: {
            name: 'prefix',
            required: false,
            type: 'string',
            maxLength: INPUT_CONSTANTS.MAX_PATH_LENGTH,
            sanitize: true,
            trim: true
        }
    },

    // List files request validation
    listFilesRequest: {
        bucketName: {
            name: 'bucketName',
            required: true,
            type: 'string',
            minLength: 3,
            maxLength: 63,
            pattern: /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
            sanitize: true,
            trim: true
        },
        prefix: {
            name: 'prefix',
            required: false,
            type: 'string',
            maxLength: INPUT_CONSTANTS.MAX_PATH_LENGTH,
            sanitize: true,
            trim: true
        },
        maxKeys: {
            name: 'maxKeys',
            required: false,
            type: 'number',
            min: 1,
            max: 1000
        },
        continuationToken: {
            name: 'continuationToken',
            required: false,
            type: 'string',
            maxLength: 1024,
            sanitize: true
        }
    }
};

// Export to global scope for browser usage
if (typeof window !== 'undefined') {
    window.InputValidator = InputValidatorInstance;
    window.ValidationSchemas = ValidationSchemas;
}