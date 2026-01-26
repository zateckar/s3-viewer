import { config } from './utils/config';
import { handleFilesRequest } from './routes/files';
import { handleBucketsRequest } from './routes/buckets';
import { addCorsHeaders } from './middleware/cors';
import { handleError } from './middleware/error';

/**
 * Main server instance
 */
const server = Bun.serve({
  port: config.port,
  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean); // Split path and remove empty segments

    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        const corsResponse = new Response(null, { status: 200 });
        return addCorsHeaders(corsResponse, request);
      }

      // API routes
      if (path[0] === 'api') {
        // Remove 'api' from path and handle version
        if (path[1] === 'v1') {
          const apiPath = path.slice(2); // Remove 'api' and 'v1'
          
          // Route to appropriate handler
          if (apiPath.length > 0 && apiPath[0] === 'files') {
            const filesPath = apiPath.slice(1); // Remove 'files'
            const response = await handleFilesRequest(request, filesPath);
            return addCorsHeaders(response, request);
          }
          
          if (apiPath.length > 0 && apiPath[0] === 'buckets') {
            const response = await handleBucketsRequest(request);
            return addCorsHeaders(response, request);
          }
        }
        
        // Return 404 for unknown API routes
        return addCorsHeaders(
          new Response(JSON.stringify({ error: 'API endpoint not found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }),
          request
        );
      }

      // Serve static files from frontend directory
      if (path.length === 0 || (path.length === 1 && path[0] === '')) {
        // Serve index.html for root path
        const file = Bun.file('./src/frontend/index.html');
        return new Response(file);
      }

      // Try to serve static files
      const filePath = './src/frontend/' + path.join('/');
      try {
        const file = Bun.file(filePath);
        const exists = await file.exists();
        
        if (exists) {
          // Determine content type based on file extension
          const ext = filePath.split('.').pop()?.toLowerCase();
          const contentType = getContentType(ext || '');
          
          return new Response(file, {
            headers: { 'Content-Type': contentType }
          });
        }
      } catch (error) {
        console.error('Error serving file:', error);
      }

      // Return 404 for unknown routes
      return addCorsHeaders(
        new Response(JSON.stringify({ error: 'Not found' }), { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }),
        request
      );
    } catch (error) {
      console.error('Server error:', error);
      const errorResponse = handleError(error);
      return addCorsHeaders(errorResponse, request);
    }
  },
});

console.log(`🚀 S3 Viewer server is running on http://localhost:${config.port}`);
console.log(`📊 Server environment: ${config.nodeEnv}`);
console.log(`🗄️  S3 endpoint: ${config.s3.endpoint}`);
console.log(`📦 S3 bucket: ${config.s3.bucketName}`);

/**
 * Determines the content type based on file extension
 */
function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'xml': 'application/xml',
  };

  return contentTypes[extension] || 'application/octet-stream';
}