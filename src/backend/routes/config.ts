import { S3ViewerConfig, ConfigTestRequest, ConfigTestResult, ApiResponse } from '../../shared/types';
import { configManager } from '../services/config-manager';
import { logger } from '../../shared/logger';
import { S3Service } from '../services/s3-client';

/**
 * Handle configuration requests
 * @param request The HTTP request
 * @param path The request path (after /config)
 * @returns Promise resolving to HTTP response
 */
export async function handleConfigRequest(request: Request, path: string[]): Promise<Response> {
  const method = request.method;
  const userId = (request as any).user?.id || 'anonymous';

  try {
    switch (method) {
      case 'GET':
        if (path.length === 0) {
          return handleGetConfig();
        }
        break;

      case 'PUT':
        if (path.length === 0) {
          return handlePutConfig(request, userId);
        }
        break;

      case 'POST':
        if (path.length === 1 && path[0] === 'test') {
          return handleTestConfig(request);
        }
        break;

      case 'DELETE':
        if (path.length === 0) {
          return handleDeleteConfig(userId);
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }), 
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ error: 'Configuration endpoint not found' }), 
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error handling configuration request:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'CONFIG_REQUEST_ERROR',
        message: error instanceof Error ? error.message : 'Failed to handle configuration request'
      }
    };
    return new Response(
      JSON.stringify(response), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle GET /api/v1/config - Get current configuration (masked)
 * Admin-only access
 */
async function handleGetConfig(): Promise<Response> {
  try {
    const config = await configManager.getMaskedConfig();
    const configExists = await configManager.getStorageService().configExists();
    
    const response: ApiResponse<S3ViewerConfig & { hasFileConfig: boolean }> = {
      success: true,
      data: {
        ...config,
        hasFileConfig: configExists
      }
    };

    return new Response(
      JSON.stringify(response), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Error getting configuration:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'CONFIG_GET_ERROR',
        message: 'Failed to retrieve configuration'
      }
    };
    return new Response(
      JSON.stringify(response), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle PUT /api/v1/config - Update configuration
 * Admin-only access
 */
async function handlePutConfig(request: Request, userId: string): Promise<Response> {
  try {
    const body = await request.json();
    const config = body as S3ViewerConfig;

    // Validate configuration
    await configManager.saveConfig(config);
    
    logger.info(`Configuration updated by user: ${userId}`, { 
      userId, 
      timestamp: new Date().toISOString() 
    });

    const response: ApiResponse<S3ViewerConfig> = {
      success: true,
      data: await configManager.getMaskedConfig(),
      message: 'Configuration updated successfully'
    };

    return new Response(
      JSON.stringify(response), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error updating configuration:', error);
    
    let errorMessage = 'Failed to update configuration';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('Configuration validation failed')) {
        errorMessage = error.message;
        statusCode = 400;
      }
    }

    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'CONFIG_UPDATE_ERROR',
        message: errorMessage,
        details: error instanceof Error ? error.message : undefined
      }
    };

    return new Response(
      JSON.stringify(response), 
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle DELETE /api/v1/config - Reset configuration to defaults
 * Admin-only access
 */
async function handleDeleteConfig(userId: string): Promise<Response> {
  try {
    await configManager.resetConfig();
    
    logger.info(`Configuration reset to defaults by user: ${userId}`, { 
      userId, 
      timestamp: new Date().toISOString() 
    });

    const response: ApiResponse<S3ViewerConfig> = {
      success: true,
      data: await configManager.getMaskedConfig(),
      message: 'Configuration reset to defaults successfully'
    };

    return new Response(
      JSON.stringify(response), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error resetting configuration:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'CONFIG_RESET_ERROR',
        message: 'Failed to reset configuration'
      }
    };
    return new Response(
      JSON.stringify(response), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle POST /api/v1/config/test - Test configuration
 * Admin-only access
 */
async function handleTestConfig(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ConfigTestRequest;
    
    if (!body.type || (body.type !== 's3' && body.type !== 'oidc')) {
      const response: ApiResponse<never> = {
        success: false,
        error: {
          code: 'INVALID_TEST_TYPE',
          message: 'Test type must be either "s3" or "oidc"'
        }
      };
      return new Response(
        JSON.stringify(response), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let testResult: ConfigTestResult;

    if (body.type === 's3') {
      testResult = await testS3Connection(body.config);
    } else if (body.type === 'oidc') {
      testResult = await testOIDCConnection(body.config);
    } else {
      throw new Error('Invalid test type');
    }

    const response: ApiResponse<ConfigTestResult> = {
      success: true,
      data: testResult,
      message: `Configuration test completed: ${testResult.success ? 'Success' : 'Failed'}`
    };

    const status = testResult.success ? 200 : 400;
    return new Response(
      JSON.stringify(response), 
      { status, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error testing configuration:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: 'CONFIG_TEST_ERROR',
        message: 'Failed to test configuration'
      }
    };
    return new Response(
      JSON.stringify(response), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Test S3 connection with provided configuration
 */
async function testS3Connection(config?: any): Promise<ConfigTestResult> {
  try {
    const currentConfig = config || (await configManager.getConfig()).s3;
    
    if (!currentConfig.endpoint || !currentConfig.accessKeyId || !currentConfig.secretAccessKey) {
      return {
        success: false,
        message: 'S3 configuration is incomplete. Endpoint, access key, and secret key are required.',
        details: { missing: ['endpoint', 'accessKeyId', 'secretAccessKey'].filter(field => !currentConfig[field]) }
      };
    }

    // Create a temporary S3 service for testing
    const tempS3Service = new S3Service();
    
    // Test by trying to validate the first bucket
    const testBucket = currentConfig.bucketNames?.[0] || 'test-bucket';
    
    try {
      const isAccessible = await tempS3Service.validateBucket(testBucket);
      
      if (isAccessible) {
        return {
          success: true,
          message: 'S3 connection test successful',
          details: {
            endpoint: currentConfig.endpoint,
            bucket: testBucket,
            accessible: true
          }
        };
      } else {
        return {
          success: false,
          message: 'S3 connection established but bucket is not accessible',
          details: {
            endpoint: currentConfig.endpoint,
            bucket: testBucket,
            accessible: false,
            error: 'Bucket validation failed'
          }
        };
      }
    } catch (s3Error) {
      return {
        success: false,
        message: 'S3 connection failed',
        details: {
          endpoint: currentConfig.endpoint,
          error: s3Error instanceof Error ? s3Error.message : 'Unknown S3 error'
        }
      };
    }

  } catch (error) {
    return {
      success: false,
      message: 'S3 configuration test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test OIDC connection with provided configuration
 */
async function testOIDCConnection(config?: any): Promise<ConfigTestResult> {
  try {
    const currentConfig = config || (await configManager.getConfig()).auth.oidc;
    
    if (!currentConfig.enabled) {
      return {
        success: false,
        message: 'OIDC is not enabled'
      };
    }

    if (!currentConfig.issuer || !currentConfig.clientId) {
      return {
        success: false,
        message: 'OIDC configuration is incomplete. Issuer and Client ID are required.',
        details: { 
          missing: ['issuer', 'clientId'].filter(field => !currentConfig[field]) 
        }
      };
    }

    try {
      // Test by constructing and calling the OIDC discovery endpoint
      const discoveryUrl = `${currentConfig.issuer}/.well-known/openid-configuration`;
      
      const response = await fetch(discoveryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const discovery = await response.json();
        
        return {
          success: true,
          message: 'OIDC connection test successful',
          details: {
            issuer: currentConfig.issuer,
            clientId: currentConfig.clientId,
            discovery: {
              supported: true,
              authEndpoint: discovery.authorization_endpoint,
              tokenEndpoint: discovery.token_endpoint,
              userInfoEndpoint: discovery.userinfo_endpoint
            }
          }
        };
      } else {
        return {
          success: false,
          message: 'OIDC discovery endpoint not accessible',
          details: {
            issuer: currentConfig.issuer,
            clientId: currentConfig.clientId,
            discoveryUrl,
            status: response.status,
            statusText: response.statusText
          }
        };
      }

    } catch (fetchError) {
      return {
        success: false,
        message: 'OIDC connection test failed',
        details: {
          issuer: currentConfig.issuer,
          error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
        }
      };
    }

  } catch (error) {
    return {
      success: false,
      message: 'OIDC configuration test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}