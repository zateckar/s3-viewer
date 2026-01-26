/**
 * Validates S3 path to prevent directory traversal attacks and ensure valid characters
 */
export function validateS3Path(path: string): boolean {
  // Prevent directory traversal attacks
  if (path.includes('..') || path.includes('//')) {
    return false;
  }
  
  // Check for valid characters (allow alphanumerics, hyphens, underscores, forward slashes, and dots)
  return /^[a-zA-Z0-9\-_\/.]+$/.test(path);
}

/**
 * Sanitizes and normalizes a path
 */
export function normalizePath(path: string): string {
  const hasTrailingSlash = path.endsWith('/') && path.length > 1;
  
  // Remove leading and trailing slashes
  let normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
  
  // Convert multiple slashes to single slash
  normalized = normalized.replace(/\/+/g, '/');
  
  if (!normalized) return '/';
  
  // Add leading slash and restore trailing slash if it was there
  return '/' + normalized + (hasTrailingSlash ? '/' : '');
}
