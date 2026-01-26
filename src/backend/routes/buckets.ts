import { S3Service } from '../services/s3-client';
import { createSuccessResponse, createErrorResponse, handleError } from '../middleware/error';
import { addCorsHeaders } from '../middleware/cors';

const s3Service = new S3Service();

/**
 * Handles bucket-related API requests
 */
export async function handleBucketsRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  try {
    switch (method) {
      case 'GET':
        if (url.searchParams.get('validate') === 'true') {
          return handleValidateBuckets();
        }
        return handleGetBuckets();
      
      case 'POST':
        return handleSwitchBucket(request);
      
      default:
        return createErrorResponse('METHOD_NOT_ALLOWED', 'Method not allowed', null, 405);
    }
  } catch (error) {
    const errorResponse = handleError(error);
    return addCorsHeaders(errorResponse, request);
  }
}

/**
 * Handles GET requests to retrieve available buckets
 */
async function handleGetBuckets(): Promise<Response> {
  try {
    const buckets = s3Service.getAvailableBuckets();
    const currentBucket = s3Service.getCurrentBucket();
    
    return createSuccessResponse({
      buckets,
      currentBucket
    });
  } catch (error) {
    console.error('Error getting buckets:', error);
    return createErrorResponse('BUCKETS_ERROR', 'Failed to retrieve buckets', null, 500);
  }
}

/**
 * Handles GET requests to validate bucket accessibility
 */
async function handleValidateBuckets(): Promise<Response> {
  try {
    const bucketInfos = await s3Service.getBucketList();
    
    return createSuccessResponse({
      buckets: bucketInfos,
      summary: {
        total: bucketInfos.length,
        accessible: bucketInfos.filter(b => b.isAccessible).length,
        inaccessible: bucketInfos.filter(b => !b.isAccessible).length
      }
    });
  } catch (error) {
    console.error('Error validating buckets:', error);
    return createErrorResponse('BUCKET_VALIDATION_ERROR', 'Failed to validate buckets', null, 500);
  }
}

/**
 * Handles POST requests to switch active bucket
 */
async function handleSwitchBucket(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { bucketName } = body;
    
    if (!bucketName) {
      return createErrorResponse('MISSING_BUCKET_NAME', 'Bucket name is required', null, 400);
    }
    
    // Validate bucket exists in configuration
    const availableBuckets = s3Service.getAvailableBuckets();
    if (!availableBuckets.includes(bucketName)) {
      return createErrorResponse('BUCKET_NOT_FOUND', `Bucket '${bucketName}' not found in configuration`, null, 404);
    }
    
    // Validate bucket accessibility
    const bucketInfos = await s3Service.getBucketList();
    const targetBucket = bucketInfos.find(b => b.name === bucketName);
    
    if (!targetBucket || !targetBucket.isAccessible) {
      return createErrorResponse('BUCKET_INACCESSIBLE', `Bucket '${bucketName}' is not accessible`, null, 403);
    }
    
    // Switch the bucket
    s3Service.setCurrentBucket(bucketName);
    
    return createSuccessResponse({
      switchedTo: bucketName,
      message: `Successfully switched to bucket '${bucketName}'`,
      currentBucket: bucketName
    });
  } catch (error) {
    console.error('Error switching bucket:', error);
    return createErrorResponse('BUCKET_SWITCH_ERROR', 'Failed to switch bucket', null, 500);
  }
}