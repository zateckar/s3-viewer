import { configManager } from '../services/config-manager';
import { logger } from '../../shared/logger';

// Legacy config object for backward compatibility
// This will be initialized with the configuration manager
let appConfig: any = null;

/**
 * Get configuration object
 * This function ensures configuration is loaded before returning
 * and maintains backward compatibility with the existing code
 */
export async function getConfig() {
  if (!appConfig) {
    try {
      appConfig = await configManager.loadConfig();
      logger.info('Configuration loaded via config manager');
    } catch (error) {
      logger.error('Error loading configuration:', error);
      // Fallback to environment variables if config manager fails
      appConfig = {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
        
        s3: {
          endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
          accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
          bucketName: process.env.S3_BUCKET_NAME?.split(',')[0].trim() || 's3-viewer-demo',
          bucketNames: process.env.S3_BUCKET_NAME?.split(',').map(b => b.trim()).filter(Boolean) || ['s3-viewer-demo'],
          region: process.env.S3_REGION || 'us-east-1',
        },
        
        security: {
          jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'default-jwt-secret-change-in-production'),
          allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        },

        auth: {
          local: {
            enabled: process.env.AUTH_LOCAL_ENABLED === 'true',
            user: process.env.AUTH_USER || 'admin',
            pass: process.env.AUTH_PASS || 'admin123',
          },
          oidc: {
            enabled: process.env.AUTH_OIDC_ENABLED === 'true',
            issuer: process.env.AUTH_OIDC_ISSUER,
            clientId: process.env.AUTH_OIDC_CLIENT_ID,
            clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
            redirectUri: process.env.AUTH_OIDC_REDIRECT_URI,
            scope: process.env.AUTH_OIDC_SCOPE || 'openid profile email',
          }
        }
      };
      logger.warn('Using fallback configuration due to config manager error');
    }
  }
  return appConfig;
}

/**
 * Export a promise-based config for async contexts
 */
export const configPromise = getConfig();

/**
 * For backward compatibility, export a config object that will be populated
 * This is used by existing synchronous code
 */
export const legacyConfig = new Proxy({}, {
  get(target, prop) {
    if (!appConfig) {
      logger.warn('Config accessed synchronously before initialization, using fallback values');
      // Return fallback values for backward compatibility
      const fallbackConfig = {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
        s3: {
          endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
          accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
          secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
          bucketName: process.env.S3_BUCKET_NAME?.split(',')[0].trim() || 's3-viewer-demo',
          bucketNames: process.env.S3_BUCKET_NAME?.split(',').map(b => b.trim()).filter(Boolean) || ['s3-viewer-demo'],
          region: process.env.S3_REGION || 'us-east-1',
        },
        security: {
          jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'default-jwt-secret-change-in-production'),
          allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        },
        auth: {
          local: {
            enabled: process.env.AUTH_LOCAL_ENABLED === 'true',
            user: process.env.AUTH_USER || 'admin',
            pass: process.env.AUTH_PASS || 'admin123',
          },
          oidc: {
            enabled: process.env.AUTH_OIDC_ENABLED === 'true',
            issuer: process.env.AUTH_OIDC_ISSUER,
            clientId: process.env.AUTH_OIDC_CLIENT_ID,
            clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
            redirectUri: process.env.AUTH_OIDC_REDIRECT_URI,
            scope: process.env.AUTH_OIDC_SCOPE || 'openid profile email',
          }
        }
      };
      return getNestedProperty(fallbackConfig, prop);
    }
    return getNestedProperty(appConfig, prop);
  }
});

/**
 * Helper function to get nested properties
 */
function getNestedProperty(obj: any, prop: string): any {
  return prop.split('.').reduce((current, key) => current?.[key], obj);
}

// Initialize configuration asynchronously
getConfig().then(loadedConfig => {
  appConfig = loadedConfig;
  logger.info('Configuration initialized successfully');
}).catch(error => {
  logger.error('Failed to initialize configuration:', error);
});

// Export default config object for backward compatibility
export const config = legacyConfig;
