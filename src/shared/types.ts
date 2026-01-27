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

// Configuration interfaces
export interface S3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketNames: string[];
  region: string;
}

export interface LocalStorageConfig {
  enabled: boolean;
  basePath: string;
}

export interface LocalAuthConfig {
  enabled: boolean;
  user: string;
  pass: string;
}

export interface OIDCAuthConfig {
  enabled: boolean;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scope: string;
}

export interface AuthConfig {
  local: LocalAuthConfig;
  oidc: OIDCAuthConfig;
}

export interface SecurityConfig {
  jwtSecret: string;
  allowedOrigins: string[];
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
}

export interface S3ViewerConfig {
  app: AppConfig;
  s3: S3Config;
  localStorage: LocalStorageConfig;
  auth: AuthConfig;
  security: SecurityConfig;
}

export interface ConfigTestRequest {
  type: 's3' | 'oidc';
  config?: Partial<S3Config | OIDCAuthConfig>;
}

export interface ConfigTestResult {
  success: boolean;
  message: string;
  details?: any;
}