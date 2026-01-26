/**
 * Shared type definitions for the S3 viewer application
 */

export interface UploadRequest {
  file: File;
  path: string;
  contentType?: string;
}

export interface UploadResponse {
  path: string;
  size: number;
  contentType: string;
  name: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
  bytesPerSecond?: number;
  estimatedTimeRemaining?: number;
}

export interface DownloadResponse {
  stream?: ReadableStream;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  acceptRanges?: boolean;
}

export interface DownloadOptions {
  range?: {
    start: number;
    end?: number;
  };
  onProgress?: (progress: DownloadProgress) => void;
  chunkSize?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface S3UploadOptions {
  contentType?: string;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
}

export interface S3DownloadOptions {
  range?: {
    start: number;
    end?: number;
  };
  onProgress?: (progress: DownloadProgress) => void;
  chunkSize?: number;
}