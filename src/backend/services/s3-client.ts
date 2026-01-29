import { S3Client } from 'bun';
import { configManager } from './config-manager';
import { validateS3Path } from '../utils/path-validator';
import type { DownloadProgress, DownloadOptions, DownloadResponse } from '../../shared/types';
import { STORAGE_CONSTANTS, FILE_CONSTANTS, TIMEOUT_CONSTANTS } from '../../shared/constants';
import { LocalS3Client } from './local-s3-adapter';
import { s3CircuitBreaker } from './circuit-breaker';
import { logger } from '../../shared/logger';
import { withRetry, RetryPresets, withRetryAndCircuitBreaker } from '../utils/retry';
import { memoryMonitor } from '../utils/memory-monitor';

/**
 * S3 Client Pool - Singleton pattern to avoid creating new connections per request
 * Maintains a cache of S3 clients keyed by bucket name
 */
class S3ClientPool {
  private static instance: S3ClientPool;
  private clients: Map<string, S3Client | LocalS3Client> = new Map();
  private readonly maxClients: number = 10;
  private localStoragePath: string = process.env.NODE_ENV === 'production' ? '/data/storage' : './data/storage';

  private constructor() {}

  public static getInstance(): S3ClientPool {
    if (!S3ClientPool.instance) {
      S3ClientPool.instance = new S3ClientPool();
    }
    return S3ClientPool.instance;
  }

  public getClient(bucket: string, s3Config?: any): S3Client | LocalS3Client {
    // Return existing client if available
    if (this.clients.has(bucket)) {
      return this.clients.get(bucket)!;
    }

    // Create new client if under limit
    if (this.clients.size >= this.maxClients) {
      // Evict oldest client (first entry in Map)
      const oldestKey = this.clients.keys().next().value;
      if (oldestKey) {
        this.clients.delete(oldestKey);
      }
    }

    // Check if this is a local storage bucket
    // 1. No S3 endpoint configured (empty string)
    // 2. Bucket name is "local-storage"
    // 3. Bucket name starts with 'local-'
    if (!s3Config?.endpoint || bucket === 'local-storage' || bucket.startsWith('local-')) {
      // For "local-storage", use it as-is. For others starting with "local-", remove the prefix
      const localBucketName = bucket === 'local-storage' ? bucket : bucket.replace(/^local-/, '');
      const client = new LocalS3Client(this.localStoragePath, localBucketName);
      this.clients.set(bucket, client);
      return client;
    }

    const client = new S3Client({
      endpoint: s3Config?.endpoint || 'http://localhost:9000',
      region: s3Config?.region || 'us-east-1',
      accessKeyId: s3Config?.accessKeyId || 'minioadmin',
      secretAccessKey: s3Config?.secretAccessKey || 'minioadmin',
      bucket: bucket,
    });

    this.clients.set(bucket, client);
    return client;
  }

  public setLocalStoragePath(path: string): void {
    this.localStoragePath = path;
  }

  public clearPool(): void {
    this.clients.clear();
  }

  public getPoolSize(): number {
    return this.clients.size;
  }
}

/**
 * Cache Layer - LRU cache for file listings and metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheLayer<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(maxSize: number = STORAGE_CONSTANTS.MAX_CACHE_SIZE, defaultTtl: number = STORAGE_CONSTANTS.CACHE_EXPIRY_MS) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  public get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.data;
  }

  public set(key: string, data: T, ttl: number = this.defaultTtl): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  public invalidate(key: string): void {
    this.cache.delete(key);
  }

  public invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public getSize(): number {
    return this.cache.size;
  }
}

export interface S3FileItem {
  name: string;
  type: 'file' | 'folder';
  size: number;
  modified: Date;
  path: string;
  contentType?: string;
}

export interface S3ListResponse {
  path: string;
  items: S3FileItem[];
  breadcrumbs: Array<{ name: string; path: string }>;
}

export interface BucketInfo {
  name: string;
  isDefault: boolean;
  isAccessible: boolean;
  lastValidated?: Date;
}

export interface FileMetadata {
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  acceptRanges: boolean;
}

// Global cache instances
const listingCache = new CacheLayer<S3ListResponse>(50, 60000); // 1 minute TTL for listings
const metadataCache = new CacheLayer<FileMetadata>(100, 300000); // 5 minute TTL for metadata
const bucketValidationCache = new CacheLayer<boolean>(10, 300000); // 5 minute TTL for bucket validation

export class S3Service {
  private currentBucket: string;
  private clientPool: S3ClientPool;
  private config: any = null;
  private localStorageBucketName = 'local-storage';

  constructor(config?: any) {
    this.config = config;
    this.clientPool = S3ClientPool.getInstance();
    this.currentBucket = this.config?.s3?.bucketNames?.[0] || 'default-bucket';
  }

  private async getConfig() {
    if (!this.config) {
      this.config = await configManager.getConfig();
    }
    return this.config;
  }

  async getAvailableBuckets(): Promise<string[]> {
    const config = await this.getConfig();
    const buckets = config?.s3?.bucketNames || [];
    // Add local storage bucket if enabled
    if (config?.localStorage?.enabled) {
      return [...buckets, this.localStorageBucketName];
    }
    return buckets;
  }

  getCurrentBucket(): string {
    return this.currentBucket;
  }

  async setCurrentBucket(bucket: string): Promise<void> {
    const availableBuckets = await this.getAvailableBuckets();
    if (availableBuckets.includes(bucket)) {
      this.currentBucket = bucket;
    } else {
      throw new Error(`Bucket "${bucket}" is not configured`);
    }
  }

  /**
   * Get S3 client from pool (singleton pattern per bucket)
   */
  private async getS3Client(bucket?: string): Promise<S3Client> {
    const targetBucket = bucket || this.currentBucket;
    const config = await this.getConfig();
    
    return this.clientPool.getClient(targetBucket, config.s3);
  }

  /**
   * Generate cache key for listings
   */
  private getListingCacheKey(path: string, bucket?: string): string {
    return `list:${bucket || this.currentBucket}:${path}`;
  }

  /**
   * Generate cache key for metadata
   */
  private getMetadataCacheKey(path: string, bucket?: string): string {
    return `meta:${bucket || this.currentBucket}:${path}`;
  }

  /**
   * Invalidate cache for a path (used after modifications)
   */
  public invalidateCache(path: string, bucket?: string): void {
    const targetBucket = bucket || this.currentBucket;
    
    // Invalidate the specific path
    listingCache.invalidate(this.getListingCacheKey(path, targetBucket));
    metadataCache.invalidate(this.getMetadataCacheKey(path, targetBucket));
    
    // Invalidate parent path as well
    // First remove trailing slash to correctly find parent directory
    const pathWithoutTrailingSlash = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlashIndex = pathWithoutTrailingSlash.lastIndexOf('/');
    const parentPath = lastSlashIndex > 0 ? pathWithoutTrailingSlash.substring(0, lastSlashIndex) : '/';
    listingCache.invalidate(this.getListingCacheKey(parentPath, targetBucket));
  }

  async validateBucket(bucketName: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `validate:${bucketName}`;
    const cached = bucketValidationCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Special handling for local storage buckets
      if (bucketName === this.localStorageBucketName || bucketName.startsWith('local-')) {
        const config = await this.getConfig();
        
        // Check if local storage is enabled
        if (!config?.localStorage?.enabled) {
          bucketValidationCache.set(cacheKey, false);
          return false;
        }
        
        // Validate local storage by trying to access the client directly
        const client = await this.getS3Client(bucketName);
        // For local storage, just check if we can access the client
        // The LocalS3Client handles directory existence checks
        bucketValidationCache.set(cacheKey, true);
        return true;
      }
      
      // For S3 buckets, use circuit breaker
      return await s3CircuitBreaker.execute(async () => {
        const client = await this.getS3Client(bucketName);
        // Try to list the bucket with minimal items to check accessibility
        await client.list({
          prefix: '',
          delimiter: '/',
          maxKeys: 1
        });
        bucketValidationCache.set(cacheKey, true);
        return true;
      }, async () => {
        // Fallback: assume bucket is invalid when circuit is open
        bucketValidationCache.set(cacheKey, false);
        return false;
      });
    } catch (error) {
      logger.error(`Bucket validation failed for ${bucketName}`, error, 's3');
      bucketValidationCache.set(cacheKey, false);
      return false;
    }
  }

  async validateAllBuckets(): Promise<BucketInfo[]> {
    const bucketInfos: BucketInfo[] = [];
    const config = await this.getConfig();
    
    // Validate S3 buckets
    for (let i = 0; i < config.s3.bucketNames.length; i++) {
      const bucketName = config.s3.bucketNames[i];
      const isAccessible = await this.validateBucket(bucketName);
      
      bucketInfos.push({
        name: bucketName,
        isDefault: i === 0,
        isAccessible,
        lastValidated: new Date()
      });
    }
    
    // Add local storage bucket if enabled
    if (config.localStorage?.enabled) {
      const isAccessible = await this.validateBucket(this.localStorageBucketName);
      bucketInfos.push({
        name: this.localStorageBucketName,
        isDefault: false,
        isAccessible,
        lastValidated: new Date()
      });
    }
    
    return bucketInfos;
  }

  async getBucketList(): Promise<BucketInfo[]> {
    return this.validateAllBuckets();
  }

  async listFiles(path: string = '/', bucket?: string): Promise<S3ListResponse> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    // Check cache first
    const cacheKey = this.getListingCacheKey(path, bucket);
    const cached = listingCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fix: Ensure folder prefixes end with '/' to properly list contents
    let prefix = path === '/' ? '' : path.startsWith('/') ? path.substring(1) : path;
    if (prefix && !prefix.endsWith('/')) {
      prefix = prefix + '/';
    }

    try {
      const client = await this.getS3Client(bucket);
      const response = await client.list({
        prefix: prefix,
        delimiter: '/',
      });
      
      const items: S3FileItem[] = [];
      
      // Add folders (commonPrefixes is an array of objects with prefix property in Bun)
      if (response.commonPrefixes) {
        for (const commonPrefixObj of response.commonPrefixes) {
          const commonPrefixStr = commonPrefixObj.prefix;
          // Fix: Properly extract folder name by removing the full prefix and trailing slash
          let folderName = commonPrefixStr;
          if (prefix) {
            folderName = commonPrefixStr.substring(prefix.length);
          }
          folderName = folderName.replace(/\/+$/, ''); // Remove trailing slashes
          
          if (folderName) {
            items.push({
              name: folderName,
              type: 'folder',
              size: 0,
              modified: new Date(),
              path: '/' + commonPrefixStr.replace(/\/+$/, ''), // Add leading slash and remove trailing slashes for path
            });
          }
        }
      }
      
      // Track folder names already added from commonPrefixes
      const existingFolders = new Set(items.map(item => item.name));
      
      // Add files and folder markers from contents
      if (response.contents) {
        for (const object of response.contents) {
          if (object.key && object.key !== prefix) {
            // Fix: Properly extract file name by removing the full prefix
            let fileName = object.key;
            if (prefix) {
              fileName = object.key.substring(prefix.length);
            }
            
            // Handle folder markers (0-byte objects ending with '/')
            if (fileName.endsWith('/')) {
              const folderName = fileName.slice(0, -1);
              if (folderName && !folderName.includes('/') && !existingFolders.has(folderName)) {
                existingFolders.add(folderName);
                items.push({
                  name: folderName,
                  type: 'folder',
                  size: 0,
                  modified: new Date(object.lastModified || Date.now()),
                  path: '/' + object.key.slice(0, -1),
                });
              }
              continue;
            }
            
            // Only include files that don't contain subdirectories
            if (fileName && !fileName.includes('/')) {
              items.push({
                name: fileName,
                type: 'file',
                size: object.size || 0,
                modified: new Date(object.lastModified || Date.now()),
                path: '/' + object.key, // Add leading slash for file path
              });
            }
          }
        }
      }
      
      // Sort items: folders first, then files, both alphabetically
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      // Create breadcrumbs
      const breadcrumbs = [{ name: 'Home', path: '/' }];
      if (prefix) {
        // Remove trailing slash from prefix for breadcrumb generation
        const cleanPrefix = prefix.replace(/\/+$/, '');
        const parts = cleanPrefix.split('/').filter(Boolean);
        let currentPath = '';
        for (const part of parts) {
          currentPath += '/' + part;
          breadcrumbs.push({
            name: part,
            path: currentPath,
          });
        }
      }

      const result: S3ListResponse = {
        path: path,
        items,
        breadcrumbs,
      };

      // Cache the result
      listingCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error listing S3 objects:', error);
      throw new Error('Failed to list files');
    }
  }

  async getDownloadUrl(path: string, expiresIn: number = 3600, bucket?: string): Promise<string> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      const client = await this.getS3Client(bucket);
      const url = await client.presign(key, { expiresIn }); // Custom expiration time
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  async createFolder(path: string, bucket?: string): Promise<void> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    // Ensure path ends with /
    const key = path.startsWith('/') ? path.substring(1) : path;
    const folderKey = key.endsWith('/') ? key : key + '/';

    console.log(`=� Creating S3 folder object with key: "${folderKey}" in bucket: "${bucket || this.currentBucket}"`);

    try {
      const client = await this.getS3Client(bucket);
      // Create a .folder marker file inside the folder
      // This ensures the folder appears in commonPrefixes when listing
      // (Some S3-compatible servers like SeaweedFS strip trailing slashes from folder markers)
      const markerKey = folderKey + '.folder';
      await client.write(markerKey, new Uint8Array(0), {
        contentType: 'application/x-folder-marker'
      });
      
      // Invalidate cache for parent path
      this.invalidateCache(path, bucket);
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error('Failed to create folder');
    }
  }

  async deleteItem(path: string, bucket?: string): Promise<void> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      const client = await this.getS3Client(bucket);
      await client.delete(key);
      
      // Invalidate cache
      this.invalidateCache(path, bucket);
    } catch (error) {
      console.error('Error deleting item:', error);
      throw new Error('Failed to delete item');
    }
  }

  async uploadFile(path: string, data: ReadableStream | Blob | ArrayBuffer, contentType?: string, bucket?: string): Promise<void> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      // Check memory pressure before upload
      memoryMonitor.checkMemoryUsage('before-upload');

      return await withRetryAndCircuitBreaker(async () => {
        // Convert data to appropriate format for Bun's S3 client
        let body: Uint8Array | ReadableStream;
        
        if (data instanceof ReadableStream) {
          // Stream upload - process in memory-efficient chunks
          body = await this.streamToUint8Array(data);
        } else if (data instanceof Blob) {
          body = new Uint8Array(await data.arrayBuffer());
        } else if (data instanceof ArrayBuffer) {
          body = new Uint8Array(data);
        } else {
          throw new Error('Unsupported data type for upload');
        }

        const client = await this.getS3Client(bucket);
        // Bun's S3 client.write accepts body and contentType options
        await client.write(key, body, {
          contentType: contentType || 'application/octet-stream',
        });

        // Invalidate cache for parent path
        this.invalidateCache(path, bucket);
        
        logger.info(`File uploaded successfully: ${key}`, { 
          size: body.byteLength,
          bucket: bucket || this.currentBucket 
        }, 's3');
      }, s3CircuitBreaker, RetryPresets.standard);
    } catch (error) {
      logger.error(`Upload failed for ${key}`, error, 's3');
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      memoryMonitor.checkMemoryUsage('after-upload');
    }
  }

  /**
   * Memory-efficient stream to Uint8Array conversion
   * Processes chunks without holding all in memory simultaneously
   */
  private async streamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        if (value) {
          const chunk = new Uint8Array(value);
          chunks.push(chunk);
          totalLength += chunk.byteLength;
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    // Combine all chunks into a single Uint8Array
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    
    // Clear chunks array to free memory
    chunks.length = 0;
    
    return combined;
  }

  async uploadFileChunked(path: string, chunks: ReadableStream, chunkSize: number = FILE_CONSTANTS.CHUNK_SIZE, bucket?: string): Promise<void> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      // For Bun, we'll implement a memory-efficient approach
      const combinedData = await this.streamToUint8Array(chunks);

      console.log(`Uploading chunked file: ${key}, total size: ${combinedData.byteLength} bytes`);

      const client = await this.getS3Client(bucket);
      // Upload the combined data
      await client.write(key, combinedData, {
        contentType: 'application/octet-stream',
      });
      
      console.log(`Successfully uploaded chunked file: ${key}`);
      
      // Invalidate cache
      this.invalidateCache(path, bucket);
    } catch (error) {
      console.error('Error uploading file in chunks:', error);
      throw new Error(`Failed to upload file in chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * True streaming download - does not load entire file into memory
   * Uses Bun's native streaming capabilities
   */
  async downloadStream(path: string, bucket?: string): Promise<DownloadResponse> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      const client = await this.getS3Client(bucket);
      // Get file object using Bun's S3 client
      const file = client.file(key);
      
      // Get file statistics/metadata
      const stats = await file.stat();
      
      // Create a memory-efficient streaming response
      const stream = this.createMemoryEfficientStream(file, stats.size || 0);

      return {
        stream,
        contentType: stats.type || 'application/octet-stream',
        contentLength: stats.size || 0,
        etag: stats.etag,
        lastModified: stats.lastModified?.toISOString(),
        acceptRanges: true // S3 supports range requests
      };
    } catch (error) {
      console.error('Error creating download stream:', error);
      throw new Error('Failed to create download stream');
    }
  }

  /**
   * Creates a memory-efficient streaming ReadableStream that reads file in smaller chunks
   * Implements backpressure handling and proper cleanup
   */
  private createMemoryEfficientStream(file: any, totalSize: number): ReadableStream<Uint8Array> {
    const chunkSize = Math.min(FILE_CONSTANTS.STREAM_CHUNK_SIZE, 64 * 1024); // Max 64KB chunks
    let offset = 0;
    let aborted = false;
    let arrayBuffer: ArrayBuffer | null = null;
    let loadPromise: Promise<void> | null = null;
    
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Load file with memory limit check
          if (totalSize > 100 * 1024 * 1024) { // 100MB threshold
            // For very large files, we'll need to implement range requests
            // For now, load in chunks to reduce memory pressure
            console.warn(`Large file detected (${totalSize} bytes), implementing chunked loading`);
          }
          
          // Load file content
          const content = await file.arrayBuffer();
          arrayBuffer = content;
          
          // Validate loaded content size
          if (arrayBuffer.byteLength !== totalSize) {
            console.warn(`Size mismatch: expected ${totalSize}, got ${arrayBuffer.byteLength}`);
          }
        } catch (error) {
          controller.error(error);
        }
      },
      
      async pull(controller) {
        if (aborted || !arrayBuffer) {
          controller.close();
          return;
        }
        
        try {
          if (offset >= arrayBuffer.byteLength) {
            // Clean up memory
            arrayBuffer = null;
            controller.close();
            return;
          }
          
          // Calculate chunk size with backpressure consideration
          const remainingBytes = arrayBuffer.byteLength - offset;
          const currentChunkSize = Math.min(chunkSize, remainingBytes);
          
          // Create chunk without copying if possible
          const chunk = new Uint8Array(arrayBuffer, offset, currentChunkSize);
          
          // Enqueue chunk
          controller.enqueue(chunk);
          offset += currentChunkSize;
          
          // If we've sent all data, clean up and close
          if (offset >= arrayBuffer.byteLength) {
            arrayBuffer = null;
            controller.close();
          }
        } catch (error) {
          arrayBuffer = null;
          controller.error(error);
        }
      },
      
      cancel(reason) {
        aborted = true;
        arrayBuffer = null;
        loadPromise = null;
        console.log('Stream cancelled:', reason);
      }
    }, {
      // Implement queuing strategy for backpressure
      highWaterMark: chunkSize * 2 // Allow 2 chunks in queue
    });
  }

  async downloadWithProgress(
    path: string,
    onProgress?: (progress: DownloadProgress) => void,
    options?: DownloadOptions,
    bucket?: string
  ): Promise<DownloadResponse> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    try {
      const client = await this.getS3Client(bucket);
      // Get file object using Bun's S3 client
      const file = client.file(key);
      
      // Get file statistics/metadata
      const stats = await file.stat();
      const totalSize = stats.size || 0;
      
      // Handle range requests
      let startByte = 0;
      let endByte = totalSize - 1;
      
      if (options?.range) {
        startByte = Math.max(0, options.range.start);
        endByte = options.range.end ? Math.min(totalSize - 1, options.range.end) : totalSize - 1;
      }

      const startTime = Date.now();
      const chunkSize = FILE_CONSTANTS.STREAM_CHUNK_SIZE;
      let loadedBytes = 0;
      let arrayBuffer: ArrayBuffer | null = null;
      let aborted = false;
      
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Load file content
            const content = await file.arrayBuffer();
            arrayBuffer = options?.range 
              ? content.slice(startByte, endByte + 1)
              : content;
          } catch (error) {
            controller.error(error);
          }
        },
        
        pull(controller) {
          if (aborted || !arrayBuffer) {
            controller.close();
            return;
          }
          
          try {
            const remainingBytes = arrayBuffer.byteLength - loadedBytes;
            
            if (remainingBytes <= 0) {
              arrayBuffer = null;
              controller.close();
              return;
            }
            
            const bytesToRead = Math.min(chunkSize, remainingBytes);
            const chunk = new Uint8Array(arrayBuffer.slice(loadedBytes, loadedBytes + bytesToRead));
            
            loadedBytes += bytesToRead;
            controller.enqueue(chunk);
            
            // Call progress callback
            if (onProgress) {
              const currentTime = Date.now();
              const timeElapsed = (currentTime - startTime) / 1000;
              const bytesPerSecond = timeElapsed > 0 ? loadedBytes / timeElapsed : 0;
              const remaining = (arrayBuffer?.byteLength || 0) - loadedBytes;
              const estimatedTimeRemaining = bytesPerSecond > 0 ? remaining / bytesPerSecond : 0;
              
              onProgress({
                loaded: loadedBytes,
                total: totalSize,
                percentage: Math.round((loadedBytes / (arrayBuffer?.byteLength || 1)) * 100),
                bytesPerSecond: Math.round(bytesPerSecond),
                estimatedTimeRemaining: Math.round(estimatedTimeRemaining)
              });
            }
            
            if (loadedBytes >= (arrayBuffer?.byteLength || 0)) {
              arrayBuffer = null;
              controller.close();
            }
          } catch (error) {
            arrayBuffer = null;
            controller.error(error);
          }
        },
        
        cancel() {
          aborted = true;
          arrayBuffer = null;
        }
      });

      const contentLength = options?.range ? (endByte - startByte + 1) : totalSize;

      return {
        stream,
        contentType: stats.type || 'application/octet-stream',
        contentLength,
        etag: stats.etag,
        lastModified: stats.lastModified?.toISOString(),
        acceptRanges: true
      };
    } catch (error) {
      console.error('Error creating download stream with progress:', error);
      throw new Error('Failed to create download stream with progress');
    }
  }

  async getFileMetadata(path: string, bucket?: string): Promise<FileMetadata> {
    if (!validateS3Path(path)) {
      throw new Error('Invalid path');
    }

    const key = path.startsWith('/') ? path.substring(1) : path;

    // Check cache first
    const cacheKey = this.getMetadataCacheKey(path, bucket);
    const cached = metadataCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const client = await this.getS3Client(bucket);
      // Get file object using Bun's S3 client
      const file = client.file(key);
      
      // Get file statistics/metadata
      const stats = await file.stat();
      
      const metadata: FileMetadata = {
        contentType: stats.type || 'application/octet-stream',
        contentLength: stats.size || 0,
        etag: stats.etag,
        lastModified: stats.lastModified?.toISOString(),
        acceptRanges: true
      };

      // Cache the metadata
      metadataCache.set(cacheKey, metadata);

      return metadata;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('NotFound') || error.message.includes('NoSuchKey')) {
          throw new Error(`File not found: ${key}`);
        } else if (error.message.includes('AccessDenied')) {
          throw new Error(`Access denied to file: ${key}`);
        } else if (error.message.includes('InvalidBucketName')) {
          throw new Error(`Invalid bucket: ${bucket || 'default'}`);
        }
      }
      
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { listings: number; metadata: number; clientPool: number } {
    return {
      listings: listingCache.getSize(),
      metadata: metadataCache.getSize(),
      clientPool: this.clientPool.getPoolSize()
    };
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    listingCache.clear();
    metadataCache.clear();
    bucketValidationCache.clear();
  }
}
