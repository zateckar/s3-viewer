import { S3ViewerConfig } from '../../shared/types';
import { configManager } from '../services/config-manager';
import { logger } from '../../shared/logger';

/**
 * Configuration Context
 * Provides centralized configuration management with async initialization
 */
let appConfig: S3ViewerConfig | null = null;
let isInitialized = false;

/**
 * Initialize configuration at application startup
 * Should be called once before any other config operations
 */
export async function initializeConfig(): Promise<S3ViewerConfig> {
  if (isInitialized && appConfig) {
    return appConfig;
  }

  try {
    appConfig = await configManager.loadConfig();
    isInitialized = true;
    logger.info('Configuration initialized successfully');
    return appConfig;
  } catch (error) {
    logger.error('Failed to initialize configuration:', error);
    throw error;
  }
}

/**
 * Get current configuration synchronously
 * Must be called after initializeConfig()
 */
export function getConfig(): S3ViewerConfig {
  if (!isInitialized || !appConfig) {
    throw new Error('Configuration not initialized. Call initializeConfig() first.');
  }
  return appConfig;
}

/**
 * Check if configuration is initialized
 */
export function isConfigInitialized(): boolean {
  return isInitialized && appConfig !== null;
}

/**
 * Get configuration manager for advanced operations (save, reset, etc.)
 */
export { configManager };

/**
 * Helper function to get nested properties using dot notation
 */
export function getNestedProperty(obj: any, prop: string): any {
  return prop.split('.').reduce((current, key) => current?.[key], obj);
}