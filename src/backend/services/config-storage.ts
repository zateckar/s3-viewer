import { S3ViewerConfig } from '../../shared/types';
import { logger } from '../../shared/logger';

/**
 * Configuration Storage Service
 * Handles reading and writing configuration to JSON file
 */
export class ConfigStorageService {
  private readonly configPath: string;

  constructor() {
    // The configuration should be stored in /data/config/.s3-viewer-config.json
    // Use environment variable if provided, otherwise default to absolute path for Docker
    this.configPath = process.env.CONFIG_PATH || (process.env.NODE_ENV === 'production' 
      ? '/data/config/.s3-viewer-config.json' 
      : './data/config/.s3-viewer-config.json');
  }

  /**
   * Read configuration from JSON file
   * @returns Promise resolving to configuration object or null if file doesn't exist
   */
  async readConfig(): Promise<S3ViewerConfig | null> {
    try {
      const file = Bun.file(this.configPath);
      const exists = await file.exists();
      
      if (!exists) {
        logger.info('Configuration file not found, will use defaults');
        return null;
      }

      const content = await file.text();
      const config = JSON.parse(content) as S3ViewerConfig;
      
      logger.info('Configuration loaded successfully from file');
      return config;
    } catch (error) {
      logger.error('Error reading configuration file:', error);
      throw new Error(`Failed to read configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Write configuration to JSON file
   * @param config The configuration object to write
   */
  async writeConfig(config: S3ViewerConfig): Promise<void> {
    try {
      // Ensure directory exists
      const dirPath = this.configPath.substring(0, this.configPath.lastIndexOf('/'));
      if (dirPath && dirPath !== '.') {
        await this.ensureDirectoryExists(dirPath);
      }

      const content = JSON.stringify(config, null, 2);
      await Bun.write(this.configPath, content);
      
      logger.info('Configuration saved successfully to file');
    } catch (error) {
      logger.error('Error writing configuration file:', error);
      throw new Error(`Failed to write configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if configuration file exists
   * @returns Promise resolving to boolean indicating if file exists
   */
  async configExists(): Promise<boolean> {
    try {
      const file = Bun.file(this.configPath);
      return await file.exists();
    } catch (error) {
      logger.error('Error checking if configuration file exists:', error);
      return false;
    }
  }

  /**
   * Delete configuration file
   * @returns Promise resolving when deletion is complete
   */
  async deleteConfig(): Promise<void> {
    try {
      const file = Bun.file(this.configPath);
      const exists = await file.exists();
      
      if (exists) {
        await file.delete();
        logger.info('Configuration file deleted successfully');
      }
    } catch (error) {
      logger.error('Error deleting configuration file:', error);
      throw new Error(`Failed to delete configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure directory exists for configuration file
   * @param dirPath Directory path to ensure exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      const dir = Bun.file(dirPath);
      const exists = await dir.exists();
      
      if (!exists) {
        // Use a simple approach to create directory structure
        // Bun doesn't have a direct mkdir -p equivalent, so we'll create the file
        // in the parent directory and let the system handle path creation
        const parts = dirPath.split('/');
        let currentPath = '';
        
        for (const part of parts) {
          if (!part) continue;
          
          currentPath += '/' + part;
          const checkDir = Bun.file(currentPath);
          
          if (!(await checkDir.exists())) {
            // For simplicity, we'll rely on the file write to create paths
            logger.info(`Directory path will be created when writing config: ${currentPath}`);
          }
        }
      }
    } catch (error) {
      logger.error('Error ensuring directory exists:', error);
      // Don't throw here, as the file write operation may still succeed
    }
  }
}

// Export singleton instance
export const configStorage = new ConfigStorageService();