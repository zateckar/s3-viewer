import { S3ViewerConfig, S3Config, AuthConfig, SecurityConfig, AppConfig, LocalAuthConfig, OIDCAuthConfig, LocalStorageConfig } from '../../shared/types';
import { configStorage } from './config-storage';
import { logger } from '../../shared/logger';
import { S3ClientPool } from './s3-client';

/**
 * Configuration Manager Service
 * Implements priority loading logic: UI Config > Environment Variables > Default Values
 */
export class ConfigManagerService {
  private config: S3ViewerConfig | null = null;
  private isLoaded = false;

  /**
   * Get storage service instance
   */
  getStorageService() {
    return configStorage;
  }

  /**
   * Load configuration with priority system
   * Priority order:
   * 1. UI Config (JSON file) - Highest priority
   * 2. Environment variables
   * 3. Default values - Lowest priority
   */
  async loadConfig(): Promise<S3ViewerConfig> {
    if (this.isLoaded && this.config) {
      return this.config;
    }

    try {
      // Start with default values (lowest priority)
      this.config = this.getDefaultConfig();
      
      // Override with environment variables (medium priority)
      const envConfig = this.getEnvironmentConfig();
      this.config = this.mergeConfigs(this.config, envConfig);
      
      // Override with UI configuration from JSON file (highest priority)
      const uiConfig = await configStorage.readConfig();
      if (uiConfig) {
        this.config = this.mergeConfigs(this.config, uiConfig);
      }

      // Configure local storage path if enabled
      if (this.config.localStorage?.enabled) {
        const clientPool = require('./s3-client').S3ClientPool.getInstance();
        clientPool.setLocalStoragePath(this.config.localStorage.basePath);
      }

      this.isLoaded = true;
      logger.info('Configuration loaded successfully with priority system');
      return this.config;
    } catch (error) {
      logger.error('Error loading configuration:', error);
      // Fall back to environment/default config if UI config fails
      if (!this.config) {
        this.config = this.mergeConfigs(
          this.getDefaultConfig(),
          this.getEnvironmentConfig()
        );
        this.isLoaded = true;
      }
      return this.config;
    }
  }

  /**
   * Get current configuration
   * @returns Current configuration or loads if not already loaded
   */
  async getConfig(): Promise<S3ViewerConfig> {
    if (!this.isLoaded || !this.config) {
      return await this.loadConfig();
    }
    return this.config;
  }

  /**
   * Save configuration to UI config (JSON file)
   * @param config Configuration to save
   */
  async saveConfig(config: S3ViewerConfig): Promise<void> {
    try {
      // Get current config to preserve actual credentials if incoming values are masked
      const currentConfig = await this.getConfig();
      
      // Check if incoming values are masked and preserve actual values if they are
      if (this.isValueMasked(config.s3.secretAccessKey)) {
        config.s3.secretAccessKey = currentConfig.s3.secretAccessKey;
      }
      
      if (this.isValueMasked(config.auth.local.pass)) {
        config.auth.local.pass = currentConfig.auth.local.pass;
      }
      
      if (config.auth.oidc.clientSecret && this.isValueMasked(config.auth.oidc.clientSecret)) {
        config.auth.oidc.clientSecret = currentConfig.auth.oidc.clientSecret;
      }
      
      if (this.isValueMasked(config.security.jwtSecret)) {
        config.security.jwtSecret = currentConfig.security.jwtSecret;
      }
      
      // Validate configuration before saving
      this.validateConfig(config);
      
      // Save to JSON file
      await configStorage.writeConfig(config);
      
      // Update in-memory config
      this.config = config;
      
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Get masked version of configuration for API responses
   * Sensitive values are masked for security
   */
  async getMaskedConfig(): Promise<S3ViewerConfig> {
    const config = await this.getConfig();
    
    return {
      ...config,
      s3: {
        ...config.s3,
        secretAccessKey: this.maskValue(config.s3.secretAccessKey),
      },
      auth: {
        local: {
          ...config.auth.local,
          pass: this.maskValue(config.auth.local.pass),
        },
        oidc: {
          ...config.auth.oidc,
          clientSecret: config.auth.oidc.clientSecret ? this.maskValue(config.auth.oidc.clientSecret) : undefined,
        }
      },
      security: {
        ...config.security,
        jwtSecret: this.maskValue(config.security.jwtSecret),
      }
    };
  }

  /**
   * Reset configuration to defaults and remove UI config file
   */
  async resetConfig(): Promise<void> {
    try {
      await configStorage.deleteConfig();
      this.config = this.mergeConfigs(
        this.getDefaultConfig(),
        this.getEnvironmentConfig()
      );
      
      logger.info('Configuration reset to defaults');
    } catch (error) {
      logger.error('Error resetting configuration:', error);
      throw error;
    }
  }

  /**
   * Get default configuration values
   */
  private getDefaultConfig(): S3ViewerConfig {
    return {
      app: {
        port: 3000,
        nodeEnv: 'development'
      },
      s3: {
        endpoint: 'http://localhost:9000',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucketNames: ['s3-viewer-demo'],
        region: 'us-east-1'
      },
      localStorage: {
        enabled: false,
        basePath: process.env.NODE_ENV === 'production' ? '/data/storage' : './data/storage'
      },
      auth: {
        local: {
          enabled: false,
          user: 'admin',
          pass: 'admin123'
        },
        oidc: {
          enabled: false,
          scope: 'openid profile email'
        }
      },
      security: {
        jwtSecret: 'default-jwt-secret-change-in-production',
        allowedOrigins: ['http://localhost:3000']
      }
    };
  }

  /**
   * Get configuration from environment variables
   */
  private getEnvironmentConfig(): Partial<S3ViewerConfig> {
    return {
      app: {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      s3: {
        endpoint: process.env.S3_ENDPOINT,
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        bucketNames: process.env.S3_BUCKET_NAME?.split(',').map(b => b.trim()).filter(Boolean),
        region: process.env.S3_REGION
      },
      localStorage: {
        enabled: process.env.LOCAL_STORAGE_ENABLED === 'true',
        basePath: process.env.LOCAL_STORAGE_PATH || (process.env.NODE_ENV === 'production' ? '/data/storage' : './data/storage')
      },
      auth: {
        local: {
          enabled: process.env.AUTH_LOCAL_ENABLED === 'true',
          user: process.env.AUTH_USER,
          pass: process.env.AUTH_PASS
        },
        oidc: {
          enabled: process.env.AUTH_OIDC_ENABLED === 'true',
          issuer: process.env.AUTH_OIDC_ISSUER,
          clientId: process.env.AUTH_OIDC_CLIENT_ID,
          clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
          redirectUri: process.env.AUTH_OIDC_REDIRECT_URI,
          scope: process.env.AUTH_OIDC_SCOPE || 'openid profile email'
        }
      },
      security: {
        jwtSecret: process.env.JWT_SECRET,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean)
      }
    };
  }

  /**
   * Merge two configuration objects with priority to the second one
   * @param base Base configuration
   * @param override Override configuration (higher priority)
   */
  private mergeConfigs(base: S3ViewerConfig, override: Partial<S3ViewerConfig>): S3ViewerConfig {
    const result: S3ViewerConfig = {
      app: {
        ...base.app,
        ...override.app
      },
      s3: {
        ...base.s3,
        ...override.s3
      },
      localStorage: {
        ...base.localStorage,
        ...override.localStorage
      },
      auth: {
        local: {
          ...base.auth.local,
          ...override.auth?.local
        },
        oidc: {
          ...base.auth.oidc,
          ...override.auth?.oidc
        }
      },
      security: {
        ...base.security,
        ...override.security
      }
    };

    // Handle special cases where null/undefined values should not override
    if (override.s3?.accessKeyId === undefined) {
      result.s3.accessKeyId = base.s3.accessKeyId;
    }
    if (override.s3?.secretAccessKey === undefined) {
      result.s3.secretAccessKey = base.s3.secretAccessKey;
    }
    if (override.s3?.bucketNames === undefined || override.s3.bucketNames?.length === 0) {
      result.s3.bucketNames = base.s3.bucketNames;
    }

    if (override.auth?.local?.user === undefined) {
      result.auth.local.user = base.auth.local.user;
    }
    if (override.auth?.local?.pass === undefined) {
      result.auth.local.pass = base.auth.local.pass;
    }

    return result;
  }

  /**
   * Validate configuration structure and values
   */
  private validateConfig(config: S3ViewerConfig): void {
    const errors: string[] = [];

    // Validate app config
    if (typeof config.app.port !== 'number' || config.app.port < 1 || config.app.port > 65535) {
      errors.push('app.port must be a valid port number (1-65535)');
    }
    if (typeof config.app.nodeEnv !== 'string') {
      errors.push('app.nodeEnv must be a string');
    }

    // Validate S3 config
    if (!config.s3.endpoint || typeof config.s3.endpoint !== 'string') {
      errors.push('s3.endpoint is required and must be a string');
    }
    if (!config.s3.accessKeyId || typeof config.s3.accessKeyId !== 'string') {
      errors.push('s3.accessKeyId is required and must be a string');
    }
    if (!config.s3.secretAccessKey || typeof config.s3.secretAccessKey !== 'string') {
      errors.push('s3.secretAccessKey is required and must be a string');
    }
    if (!Array.isArray(config.s3.bucketNames) || config.s3.bucketNames.length === 0) {
      errors.push('s3.bucketNames must be a non-empty array');
    }
    if (!config.s3.region || typeof config.s3.region !== 'string') {
      errors.push('s3.region is required and must be a string');
    }

    // Validate auth config
    if (config.auth.local.enabled) {
      if (!config.auth.local.user || typeof config.auth.local.user !== 'string') {
        errors.push('auth.local.user is required when local auth is enabled');
      }
      if (!config.auth.local.pass || typeof config.auth.local.pass !== 'string') {
        errors.push('auth.local.pass is required when local auth is enabled');
      }
    }

    if (config.auth.oidc.enabled) {
      if (!config.auth.oidc.issuer || typeof config.auth.oidc.issuer !== 'string') {
        errors.push('auth.oidc.issuer is required when OIDC auth is enabled');
      }
      if (!config.auth.oidc.clientId || typeof config.auth.oidc.clientId !== 'string') {
        errors.push('auth.oidc.clientId is required when OIDC auth is enabled');
      }
    }

    // Validate security config
    if (!config.security.jwtSecret || typeof config.security.jwtSecret !== 'string') {
      errors.push('security.jwtSecret is required and must be a string');
    }
    if (!Array.isArray(config.security.allowedOrigins)) {
      errors.push('security.allowedOrigins must be an array');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Mask sensitive values for display in API responses
   */
  private maskValue(value: string): string {
    if (!value || value.length <= 4) {
      return '*'.repeat(value?.length || 8);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 4);
  }

  /**
   * Check if a value is masked (contains asterisks)
   */
  private isValueMasked(value: string): boolean {
    return !value || value.includes('*') && value.length > 4;
  }
}

// Export singleton instance
export const configManager = new ConfigManagerService();