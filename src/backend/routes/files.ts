import { S3Service } from '../services/s3-client';
import { createSuccessResponse, createErrorResponse, handleError, AppErrorResponse } from '../middleware/error';
import { addCorsHeaders } from '../middleware/cors';
import { normalizePath, validateS3Path } from '../utils/path-validator';
import type { UploadResponse, DownloadOptions } from '../../shared/types';
import { FILE_CONSTANTS, INPUT_CONSTANTS, FILE_TYPE_CONSTANTS } from '../../shared/constants';

const s3Service = new S3Service();

/**
 * Input Validation Utilities for Backend
 */
class RequestValidator {
  /**
   * Validates and sanitizes a file path
   */
  static validatePath(path: string | null, required: boolean = true): { isValid: boolean; sanitized: string; error?: string } {
    if (!path) {
      if (required) {
        return { isValid: false, sanitized: '', error: 'Path parameter is required' };
      }
      return { isValid: true, sanitized: '/' };
    }

    // Sanitize the path
    let sanitized = path.trim();
    
    // Check for path traversal attempts
    if (sanitized.includes('..')) {
      return { isValid: false, sanitized: '', error: 'Path traversal not allowed' };
    }

    // Check for null bytes
    if (sanitized.includes('\0')) {
      return { isValid: false, sanitized: '', error: 'Invalid characters in path' };
    }

    // Check path length
    if (sanitized.length > INPUT_CONSTANTS.MAX_PATH_LENGTH) {
      return { isValid: false, sanitized: '', error: 'Path exceeds maximum length' };
    }

    // Validate path characters
    if (!validateS3Path(sanitized)) {
      return { isValid: false, sanitized: '', error: 'Path contains invalid characters' };
    }

    return { isValid: true, sanitized: normalizePath(sanitized) };
  }

  /**
   * Validates a bucket name
   */
  static validateBucketName(bucket: string | null): { isValid: boolean; sanitized: string; error?: string } {
    if (!bucket) {
      return { isValid: true, sanitized: '' }; // Optional, use default
    }

    const sanitized = bucket.trim().toLowerCase();

    // Bucket name validation (S3 compliant)
    if (sanitized.length < 3 || sanitized.length > 63) {
      return { isValid: false, sanitized: '', error: 'Bucket name must be 3-63 characters long' };
    }

    const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
    if (!bucketNameRegex.test(sanitized)) {
      return { isValid: false, sanitized: '', error: 'Invalid bucket name format' };
    }

    if (sanitized.includes('..')) {
      return { isValid: false, sanitized: '', error: 'Bucket name cannot contain consecutive dots' };
    }

    return { isValid: true, sanitized };
  }

  /**
   * Validates a file name
   */
  static validateFileName(fileName: string | null): { isValid: boolean; sanitized: string; error?: string } {
    if (!fileName) {
      return { isValid: false, sanitized: '', error: 'File name is required' };
    }

    // Remove dangerous characters
    let sanitized = fileName.replace(/[\\/:"*?<>|]/g, '');
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    sanitized = sanitized.trim();

    if (sanitized.length === 0) {
      return { isValid: false, sanitized: '', error: 'File name is invalid after sanitization' };
    }

    if (sanitized.length > INPUT_CONSTANTS.MAX_FILENAME_LENGTH) {
      return { isValid: false, sanitized: '', error: 'File name exceeds maximum length' };
    }

    return { isValid: true, sanitized };
  }

  /**
   * Validates file size
   */
  static validateFileSize(size: number): { isValid: boolean; error?: string } {
    if (size <= 0) {
      return { isValid: false, error: 'File is empty' };
    }

    if (size > FILE_CONSTANTS.MAX_FILE_SIZE) {
      return { isValid: false, error: `File size exceeds maximum allowed (${FILE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB)` };
    }

    return { isValid: true };
  }

  /**
   * Validates content type
   */
  static sanitizeContentType(contentType: string | null): string {
    if (!contentType) {
      return 'application/octet-stream';
    }

    // Remove any parameters and trim
    const sanitized = contentType.split(';')[0].trim().toLowerCase();
    
    // Basic validation of content type format
    if (!/^[\w-]+\/[\w-+.]+$/.test(sanitized)) {
      return 'application/octet-stream';
    }

    return sanitized;
  }
}

/**
 * Handles file-related API requests
 */
export async function handleFilesRequest(request: Request, path: string[]): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  try {
    switch (method) {
      case 'GET':
        if (path.length === 1 && path[0] === 'download') {
          return handleDownloadRequest(url);
        }
        if (path.length === 1 && path[0] === 'info') {
          return handleInfoRequest(url);
        }
        if (path.length === 1 && path[0] === 'preview') {
          return handlePreviewRequest(url);
        }
        if (path.length >= 2 && path[path.length - 1] === 'stream') {
          const filePath = '/' + path.slice(0, -1).join('/');
          return handleStreamDownloadRequest(filePath, url);
        }
        if (path.length >= 2 && path[path.length - 2] === 'files' && path[path.length - 1] === 'stream') {
          return handleStreamDownloadRequest('', url);
        }
        // Handle file listing request
        const fullPath = path.length > 0 ? '/' + path.join('/') : '/';
        const cleanPath = fullPath !== '/' && fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath;
        return handleListRequest(cleanPath, url);

      case 'POST':
        if (path.length === 1 && path[0] === 'upload') {
          return handleUploadRequest(request);
        }
        return handlePostRequest(request);

      case 'DELETE':
        if (path.length === 0) {
          return createErrorResponse('MISSING_PATH', 'Path is required for deletion', null, 400);
        }
        const deletePath = '/' + path.join('/');
        const cleanDeletePath = deletePath !== '/' && deletePath.endsWith('/') ? deletePath.slice(0, -1) : deletePath;
        return handleDeleteRequest(cleanDeletePath, url);

      default:
        return createErrorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', null, 405);
    }
  } catch (error) {
    const errorResponse = handleError(error);
    return addCorsHeaders(errorResponse, request);
  }
}

/**
 * Handles file listing requests with validation
 */
async function handleListRequest(path: string, url?: URL): Promise<Response> {
  // Validate path
  const pathValidation = RequestValidator.validatePath(path, false);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Validate bucket
  const bucket = url?.searchParams.get('bucket');
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    const result = await s3Service.listFiles(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );
    return createSuccessResponse(result);
  } catch (error) {
    console.error('Error listing files:', error);
    return createErrorResponse('LIST_ERROR', 'Failed to list files', null, 500);
  }
}

/**
 * Handles file download requests with validation
 */
async function handleDownloadRequest(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path');
  const streamMode = url.searchParams.get('stream') === 'true';
  const bucket = url.searchParams.get('bucket');
  
  // Validate path
  const pathValidation = RequestValidator.validatePath(filePath, true);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Validate bucket
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    if (streamMode) {
      return await handleStreamDownloadRequest(pathValidation.sanitized, url);
    } else {
      const downloadUrl = await s3Service.getDownloadUrl(
        pathValidation.sanitized, 
        3600, 
        bucketValidation.sanitized || undefined
      );
      return createSuccessResponse({ downloadUrl });
    }
  } catch (error) {
    console.error('Error handling download:', error);
    return createErrorResponse('DOWNLOAD_ERROR', 'Failed to generate download URL', null, 500);
  }
}

/**
 * Handles streaming download requests with validation
 */
async function handleStreamDownloadRequest(filePath: string, url: URL): Promise<Response> {
  // Get path from URL params if not provided directly
  const pathParam = filePath || url.searchParams.get('path');
  const bucket = url.searchParams.get('bucket');

  // Validate path
  const pathValidation = RequestValidator.validatePath(pathParam, true);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Validate bucket
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    // Parse range header for partial content requests
    const rangeHeader = url.searchParams.get('range') || '';
    let options: DownloadOptions | undefined;

    if (rangeHeader) {
      const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : undefined;
        
        // Validate range values
        if (start < 0 || (end !== undefined && end < start)) {
          return createErrorResponse('INVALID_RANGE', 'Invalid range specified', null, 400);
        }
        
        options = { range: { start, end } };
      }
    }

    // Get file metadata first
    const metadata = await s3Service.getFileMetadata(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );

    // Create download stream
    const downloadResponse = await s3Service.downloadStream(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );

    if (!downloadResponse.stream) {
      return createErrorResponse('STREAM_ERROR', 'Failed to create download stream', null, 500);
    }

    // Create response headers
    const headers: Record<string, string> = {
      'Content-Type': downloadResponse.contentType || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };

    if (downloadResponse.contentLength) {
      headers['Content-Length'] = downloadResponse.contentLength.toString();
    }

    if (downloadResponse.etag) {
      headers['ETag'] = downloadResponse.etag;
    }

    if (downloadResponse.lastModified) {
      headers['Last-Modified'] = downloadResponse.lastModified;
    }

    // Handle range response
    if (options?.range) {
      const { start, end } = options.range;
      const contentLength = downloadResponse.contentLength || 0;
      const partialLength = end ? (end - start + 1) : (contentLength - start);
      
      headers['Content-Range'] = `bytes ${start}-${end ? end : contentLength - 1}/${contentLength}`;
      headers['Content-Length'] = partialLength.toString();

      return new Response(downloadResponse.stream, {
        status: 206, // Partial Content
        headers
      });
    }

    return new Response(downloadResponse.stream, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in streaming download:', error);
    
    if (error instanceof Error && (error.message.includes('NotFound') || error.message.includes('NoSuchKey') || error.message.includes('not found'))) {
      return createErrorResponse('FILE_NOT_FOUND', 'File not found', null, 404);
    }
    
    if (error instanceof Error && error.message.includes('AccessDenied')) {
      return createErrorResponse('ACCESS_DENIED', 'Access denied', null, 403);
    }

    return createErrorResponse('DOWNLOAD_ERROR', 'Failed to download file', null, 500);
  }
}

/**
 * Handles image preview requests with validation
 */
async function handlePreviewRequest(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path');
  const bucket = url.searchParams.get('bucket');
  
  // Validate path
  const pathValidation = RequestValidator.validatePath(filePath, true);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Validate bucket
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    // Check if file exists and get metadata
    const metadata = await s3Service.getFileMetadata(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );
    
    // Check if it's an image file
    const contentType = metadata.contentType || '';
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp', 'image/x-icon'];
    
    if (!imageTypes.some(type => contentType.toLowerCase().includes(type))) {
      return createErrorResponse('INVALID_IMAGE_TYPE', 'File is not a supported image type', null, 400);
    }

    // Get presigned URL for the image
    const previewUrl = await s3Service.getDownloadUrl(
      pathValidation.sanitized, 
      3600, 
      bucketValidation.sanitized || undefined
    );
    
    return createSuccessResponse({
      previewUrl,
      metadata: {
        contentType,
        size: metadata.contentLength,
        lastModified: metadata.lastModified
      }
    });

  } catch (error) {
    console.error('Error in preview request:', error);
    
    if (error instanceof Error && (error.message.includes('NotFound') || error.message.includes('NoSuchKey') || error.message.includes('not found'))) {
      return createErrorResponse('FILE_NOT_FOUND', 'File not found', null, 404);
    }
    
    if (error instanceof Error && error.message.includes('AccessDenied')) {
      return createErrorResponse('ACCESS_DENIED', 'Access denied', null, 403);
    }

    return createErrorResponse('PREVIEW_ERROR', 'Failed to generate preview', null, 500);
  }
}

/**
 * Handles file information requests with validation
 */
async function handleInfoRequest(url: URL): Promise<Response> {
  const filePath = url.searchParams.get('path');
  const bucket = url.searchParams.get('bucket');
  
  // Validate path
  const pathValidation = RequestValidator.validatePath(filePath, true);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Validate bucket
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    const metadata = await s3Service.getFileMetadata(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );
    
    return createSuccessResponse({
      path: pathValidation.sanitized,
      size: metadata.contentLength,
      contentType: metadata.contentType,
      lastModified: metadata.lastModified,
      supportsStreaming: true
    });
  } catch (error) {
    console.error('Error in info request:', error);
    if (error instanceof Error && (error.message.includes('NotFound') || error.message.includes('NoSuchKey') || error.message.includes('not found'))) {
      return createErrorResponse('FILE_NOT_FOUND', `File not found: ${filePath || 'unknown'}`, null, 404);
    }
    if (error instanceof Error && error.message.includes('AccessDenied')) {
      return createErrorResponse('ACCESS_DENIED', 'Access denied to file', null, 403);
    }
    return createErrorResponse('INFO_ERROR', `Failed to get file information: ${error instanceof Error ? error.message : 'Unknown error'}`, null, 500);
  }
}

/**
 * Handles POST requests for creating folders with validation
 */
async function handlePostRequest(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const bucket = url.searchParams.get('bucket');

    // Validate bucket
    const bucketValidation = RequestValidator.validateBucketName(bucket);
    if (!bucketValidation.isValid) {
      return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
    }
    
    if (body.action === 'create-folder') {
      // Validate path
      const pathValidation = RequestValidator.validatePath(body.path, true);
      if (!pathValidation.isValid) {
        return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
      }

      await s3Service.createFolder(
        pathValidation.sanitized, 
        bucketValidation.sanitized || undefined
      );
      
      return createSuccessResponse(null, 'Folder created successfully');
    }

    return createErrorResponse('INVALID_ACTION', 'Invalid action specified', null, 400);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', null, 400);
    }
    console.error('Error in POST request:', error);
    return createErrorResponse('POST_ERROR', 'Failed to process request', null, 500);
  }
}

/**
 * Handles DELETE requests for files and folders with validation
 */
async function handleDeleteRequest(path: string, url?: URL): Promise<Response> {
  // Validate path
  const pathValidation = RequestValidator.validatePath(path, true);
  if (!pathValidation.isValid) {
    return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
  }

  // Prevent deleting root
  if (pathValidation.sanitized === '/') {
    return createErrorResponse('INVALID_OPERATION', 'Cannot delete root directory', null, 400);
  }

  // Validate bucket
  const bucket = url?.searchParams.get('bucket');
  const bucketValidation = RequestValidator.validateBucketName(bucket);
  if (!bucketValidation.isValid) {
    return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
  }

  try {
    await s3Service.deleteItem(
      pathValidation.sanitized, 
      bucketValidation.sanitized || undefined
    );
    return createSuccessResponse(null, 'Item deleted successfully');
  } catch (error) {
    console.error('Error deleting item:', error);
    
    if (error instanceof Error && (error.message.includes('NotFound') || error.message.includes('NoSuchKey'))) {
      return createErrorResponse('FILE_NOT_FOUND', 'Item not found', null, 404);
    }
    
    return createErrorResponse('DELETE_ERROR', 'Failed to delete item', null, 500);
  }
}

/**
 * Handles file upload requests with comprehensive validation
 */
async function handleUploadRequest(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const bucket = url.searchParams.get('bucket');
    const contentType = request.headers.get('content-type') || '';
    
    // Validate content type
    if (!contentType.includes('multipart/form-data')) {
      return createErrorResponse('INVALID_CONTENT_TYPE', 'Content-Type must be multipart/form-data', null, 400);
    }

    // Validate bucket
    const bucketValidation = RequestValidator.validateBucketName(bucket);
    if (!bucketValidation.isValid) {
      return createErrorResponse('INVALID_BUCKET', bucketValidation.error!, null, 400);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filePath = formData.get('path') as string;

    // Validate file presence
    if (!file) {
      return createErrorResponse('MISSING_FILE', 'File is required for upload', null, 400);
    }

    // Validate file size
    const sizeValidation = RequestValidator.validateFileSize(file.size);
    if (!sizeValidation.isValid) {
      return createErrorResponse('INVALID_FILE_SIZE', sizeValidation.error!, null, 400);
    }

    // Validate file name
    const fileNameValidation = RequestValidator.validateFileName(file.name);
    if (!fileNameValidation.isValid) {
      return createErrorResponse('INVALID_FILENAME', fileNameValidation.error!, null, 400);
    }

    // Validate path
    const pathValidation = RequestValidator.validatePath(filePath, true);
    if (!pathValidation.isValid) {
      return createErrorResponse('INVALID_PATH', pathValidation.error!, null, 400);
    }

    // Construct full path with sanitized file name
    let fullPath: string;
    if (pathValidation.sanitized === '/') {
      fullPath = '/' + fileNameValidation.sanitized;
    } else if (pathValidation.sanitized.endsWith('/')) {
      fullPath = pathValidation.sanitized + fileNameValidation.sanitized;
    } else {
      fullPath = pathValidation.sanitized + '/' + fileNameValidation.sanitized;
    }
    
    console.log(`Upload path details:`, {
      originalPath: filePath,
      normalizedPath: pathValidation.sanitized,
      sanitizedFileName: fileNameValidation.sanitized,
      fullPath,
      fileSize: file.size
    });

    // Sanitize content type
    const fileContentType = RequestValidator.sanitizeContentType(file.type);

    // Convert file to ArrayBuffer for reliable upload
    const fileBuffer = await file.arrayBuffer();

    try {
      await s3Service.uploadFile(
        fullPath, 
        fileBuffer, 
        fileContentType, 
        bucketValidation.sanitized || undefined
      );

      const uploadResponse: UploadResponse = {
        path: fullPath,
        size: file.size,
        contentType: fileContentType,
        name: fileNameValidation.sanitized,
      };

      return createSuccessResponse(uploadResponse, 'File uploaded successfully');
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      return createErrorResponse('UPLOAD_FAILED', `Upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`, null, 500);
    }
  } catch (error) {
    console.error('Request processing error:', error);
    
    if (error instanceof Error && error.message.includes('Failed to parse form data')) {
      return createErrorResponse('INVALID_FORM_DATA', 'Invalid form data in request', null, 400);
    }
    
    return createErrorResponse('PROCESSING_ERROR', 'Error processing upload request', null, 500);
  }
}
