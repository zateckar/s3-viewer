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
  // Remove leading and trailing slashes
  let normalized = path.replace(/^\/+/, '').replace(/\/+$/, '');
  
  // Convert multiple slashes to single slash
  normalized = normalized.replace(/\/+/g, '/');
  
  // Add leading slash if path is not empty
  return normalized ? '/' + normalized : '/';
}