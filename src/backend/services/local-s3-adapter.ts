/**
 * Local S3-Compatible Adapter
 * Wraps the local filesystem with an S3-like interface
 * Implements the Bun S3Client interface for seamless integration
 */

import { $ } from 'bun';

/**
 * S3File interface - mimics Bun's S3 file object
 */
interface S3File {
  stat(): Promise<{
    type: string;
    size: number;
    etag?: string;
    lastModified?: Date;
  }>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Local S3Client - implements Bun S3Client interface using filesystem
 * Cross-platform compatible (Windows, macOS, Linux)
 */
export class LocalS3Client {
  private basePath: string;
  private bucket: string;

  constructor(basePath: string, bucket: string) {
    // Normalize path to use forward slashes (works on all platforms in Node/Bun)
    this.basePath = this.normalizePath(basePath);
    this.bucket = bucket;
  }

  /**
   * Normalize paths to be cross-platform compatible
   * Converts Windows backslashes to forward slashes
   */
  private normalizePath(path: string): string {
    // Convert backslashes to forward slashes for consistent cross-platform handling
    return path.replace(/\\/g, '/');
  }

  /**
   * Get file object for a given key
   */
  file(key: string): S3File {
    const filePath = this.getFullPath(key);

    return {
      stat: async () => {
        try {
          const stats = await Bun.file(filePath).stat();
          return {
            type: await this.getMimeType(filePath),
            size: stats.size,
            etag: `"${stats.mtime?.getTime()}"`,
            lastModified: stats.mtime,
          };
        } catch (error) {
          throw new Error(`File not found: ${key}`);
        }
      },

      arrayBuffer: async () => {
        try {
          return await Bun.file(filePath).arrayBuffer();
        } catch (error) {
          throw new Error(`Failed to read file: ${key}`);
        }
      },
    };
  }

  /**
   * Write a file to the filesystem
   */
  async write(key: string, data: Uint8Array | ReadableStream, options?: { contentType?: string }): Promise<void> {
    const filePath = this.getFullPath(key);
    
    try {
      // Create directory structure if needed
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      await this.ensureDir(dir);

      // Handle ReadableStream data
      let buffer: Uint8Array;
      if (data instanceof ReadableStream) {
        buffer = await this.streamToUint8Array(data);
      } else {
        buffer = data;
      }

      // Write file
      await Bun.write(filePath, buffer);
      console.log(`Written file: ${key} (${buffer.byteLength} bytes)`);
    } catch (error) {
      console.error(`Error writing file ${key}:`, error);
      throw new Error(`Failed to write file: ${key}`);
    }
  }

  /**
   * Delete a file from the filesystem
   */
  async delete(key: string): Promise<void> {
    const filePath = this.getFullPath(key);

    try {
      // Check if it's a directory (ends with /)
      if (key.endsWith('/')) {
        // Remove directory and all contents
        const dir = filePath.slice(0, -1);
        await this.removeDir(dir);
      } else {
        // Remove file
        const file = Bun.file(filePath);
        if (await file.exists()) {
          await $`rm ${filePath}`.quiet();
        }
      }
      console.log(`Deleted: ${key}`);
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      throw new Error(`Failed to delete: ${key}`);
    }
  }

  /**
   * List objects with prefix and delimiter support
   */
  async list(options: { prefix?: string; delimiter?: string; maxKeys?: number } = {}): Promise<{
    contents: Array<{ key: string; size: number; lastModified: Date }>;
    commonPrefixes: Array<{ prefix: string }>;
  }> {
    const prefix = options.prefix || '';
    const delimiter = options.delimiter || '';
    const maxKeys = options.maxKeys || 1000;

    try {
      const baseDirPath = prefix ? this.getFullPath(prefix) : this.basePath;
      const baseDir = Bun.file(baseDirPath);

      if (!(await baseDir.exists())) {
        return { contents: [], commonPrefixes: [] };
      }

      const contents: Array<{ key: string; size: number; lastModified: Date }> = [];
      const commonPrefixSet = new Set<string>();
      let count = 0;

      // Read directory recursively or with delimiter
      if (delimiter) {
        // List only immediate children (like S3 delimiter behavior)
        for await (const entry of baseDir.stream()!) {
          if (count >= maxKeys) break;

          const entryName = entry.name;
          const entryPath = `${baseDirPath}/${entryName}`;
          const entryFile = Bun.file(entryPath);
          const isDir = await entryFile.isDirectory?.();

          if (isDir) {
            // Add as common prefix
            const prefixKey = prefix ? `${prefix}${entryName}/` : `${entryName}/`;
            commonPrefixSet.add(prefixKey);
          } else {
            // Add as file
            const stat = await entryFile.stat?.();
            const key = prefix ? `${prefix}${entryName}` : entryName;
            contents.push({
              key,
              size: stat?.size || 0,
              lastModified: stat?.mtime || new Date(),
            });
            count++;
          }
        }
      } else {
        // Recursive listing without delimiter
        await this.listRecursive(baseDirPath, prefix, contents, maxKeys - count);
      }

      return {
        contents: contents.slice(0, maxKeys),
        commonPrefixes: Array.from(commonPrefixSet).map((prefix) => ({ prefix })),
      };
    } catch (error) {
      console.error(`Error listing ${prefix}:`, error);
      throw new Error(`Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned URL (not applicable for local filesystem, return direct URL)
   */
  async presign(key: string, options?: { expiresIn?: number }): Promise<string> {
    // For local filesystem, return a path-based URL
    // This assumes the filesystem is served via HTTP
    return `/local-storage/${this.bucket}/${key}`;
  }

  /**
   * Private helper methods
   */

  private getFullPath(key: string): string {
    // Normalize path - remove leading slash
    const normalizedKey = key.startsWith('/') ? key.substring(1) : key;
    // Use forward slashes for cross-platform compatibility
    const fullPath = `${this.basePath}/${this.bucket}/${normalizedKey}`;
    return this.normalizePath(fullPath);
  }

  private async getMimeType(filePath: string): Promise<string> {
    const ext = filePath.substring(filePath.lastIndexOf('.') + 1).toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'xml': 'application/xml',
      'zip': 'application/zip',
      'mp4': 'video/mp4',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      const dir = Bun.file(dirPath);
      if (!(await dir.exists())) {
        await $`mkdir -p ${dirPath}`.quiet();
      }
    } catch (error) {
      console.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }

  private async removeDir(dirPath: string): Promise<void> {
    try {
      await $`rm -rf ${dirPath}`.quiet();
    } catch (error) {
      console.error(`Error removing directory ${dirPath}:`, error);
      throw error;
    }
  }

  private async listRecursive(
    dirPath: string,
    prefix: string,
    contents: Array<{ key: string; size: number; lastModified: Date }>,
    maxCount: number
  ): Promise<void> {
    if (contents.length >= maxCount) return;

    try {
      const dir = Bun.file(dirPath);
      for await (const entry of dir.stream()!) {
        if (contents.length >= maxCount) break;

        const entryPath = `${dirPath}/${entry.name}`;
        const entryFile = Bun.file(entryPath);
        const isDir = await entryFile.isDirectory?.();

        if (isDir) {
          // Recurse into directory
          const relPath = entryPath.substring(this.basePath.length + 1 + this.bucket.length);
          await this.listRecursive(entryPath, relPath, contents, maxCount - contents.length);
        } else {
          // Add file
          const stat = await entryFile.stat?.();
          const relPath = entryPath.substring(this.basePath.length + 1 + this.bucket.length);
          contents.push({
            key: relPath,
            size: stat?.size || 0,
            lastModified: stat?.mtime || new Date(),
          });
        }
      }
    } catch (error) {
      console.error(`Error during recursive list:`, error);
    }
  }

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

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return combined;
  }
}
