/**
 * API Module - Centralized API communication layer
 * Provides consistent request/response handling with error management
 */

/**
 * API Configuration
 */
const API_CONFIG = {
  baseUrl: '/api/v1',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * HTTP Error class for API errors
 */
class APIError extends Error {
  constructor(code, message, statusCode, retryable = false) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Makes an API request with consistent error handling
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object|null} data - Request body data
 * @param {object} options - Additional options
 * @returns {Promise<object>} API response
 */
async function apiRequest(method, url, data = null, options = {}) {
  const requestOptions = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...window.Auth?.getAuthHeader(),
      ...options.headers,
    },
    signal: options.signal,
  };

  if (data && method !== 'GET') {
    requestOptions.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, requestOptions);
    const json = await response.json();

    if (!response.ok) {
      throw new APIError(
        json.error?.code || 'UNKNOWN_ERROR',
        json.error?.message || 'An error occurred',
        response.status,
        json.error?.retryable || false
      );
    }

    return json;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    // Network or other errors
    throw new APIError(
      'NETWORK_ERROR',
      error.message || 'Network error occurred',
      0,
      true
    );
  }
}

/**
 * API Request with retry logic
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {object|null} data - Request body data
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<object>} API response
 */
async function apiRequestWithRetry(method, url, data = null, maxRetries = API_CONFIG.retryAttempts) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiRequest(method, url, data);
    } catch (error) {
      lastError = error;
      
      // Don't retry non-retryable errors
      if (!error.retryable || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = API_CONFIG.retryDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Files API endpoints
 */
const FilesAPI = {
  /**
   * List files in a directory
   * @param {string} path - Directory path
   * @param {string|null} bucket - Bucket name
   * @returns {Promise<object>} List response
   */
  async list(path = '/', bucket = null) {
    let pathForApi = path;
    if (path !== '/') {
      pathForApi = path.replace(/^\/+/, '').replace(/\/+$/, '');
    }
    
    const pathSegments = pathForApi.split('/').map(segment => encodeURIComponent(segment));
    const apiPath = path === '/' ? `${API_CONFIG.baseUrl}/files` : `${API_CONFIG.baseUrl}/files/${pathSegments.join('/')}`;
    const url = bucket ? `${apiPath}?bucket=${encodeURIComponent(bucket)}` : apiPath;
    
    return apiRequest('GET', url);
  },

  /**
   * Get file download URL
   * @param {string} path - File path
   * @param {string|null} bucket - Bucket name
   * @param {boolean} stream - Use streaming mode
   * @returns {Promise<object>} Download URL response
   */
  async getDownloadUrl(path, bucket = null, stream = false) {
    const cleanPath = path.replace(/^\/+/, '');
    let url = `${API_CONFIG.baseUrl}/files/download?path=${encodeURIComponent(cleanPath)}`;
    if (bucket) url += `&bucket=${encodeURIComponent(bucket)}`;
    if (stream) url += '&stream=true';
    
    return apiRequest('GET', url);
  },

  /**
   * Get file info/metadata
   * @param {string} path - File path
   * @param {string|null} bucket - Bucket name
   * @returns {Promise<object>} File info response
   */
  async getInfo(path, bucket = null) {
    const cleanPath = path.replace(/^\/+/, '');
    let url = `${API_CONFIG.baseUrl}/files/info?path=${encodeURIComponent(cleanPath)}`;
    if (bucket) url += `&bucket=${encodeURIComponent(bucket)}`;
    
    return apiRequest('GET', url);
  },

  /**
   * Get image preview URL
   * @param {string} path - Image path
   * @param {string|null} bucket - Bucket name
   * @returns {Promise<object>} Preview URL response
   */
  async getPreviewUrl(path, bucket = null) {
    const cleanPath = path.replace(/^\/+/, '');
    let url = `${API_CONFIG.baseUrl}/files/preview?path=${encodeURIComponent(cleanPath)}`;
    if (bucket) url += `&bucket=${encodeURIComponent(bucket)}`;
    
    return apiRequest('GET', url);
  },

  /**
   * Create a folder
   * @param {string} path - Folder path
   * @param {string|null} bucket - Bucket name
   * @returns {Promise<object>} Create response
   */
  async createFolder(path, bucket = null) {
    let url = `${API_CONFIG.baseUrl}/files`;
    if (bucket) url += `?bucket=${encodeURIComponent(bucket)}`;
    
    return apiRequest('POST', url, {
      action: 'create-folder',
      path: path,
    });
  },

  /**
   * Delete a file or folder
   * @param {string} path - Item path
   * @param {string|null} bucket - Bucket name
   * @returns {Promise<object>} Delete response
   */
  async delete(path, bucket = null) {
    const pathSegments = path.replace(/^\/+/, '').split('/').map(segment => encodeURIComponent(segment));
    let url = `${API_CONFIG.baseUrl}/files/${pathSegments.join('/')}`;
    if (bucket) url += `?bucket=${encodeURIComponent(bucket)}`;
    
    return apiRequest('DELETE', url);
  },

  /**
   * Upload a file
   * @param {File} file - File to upload
   * @param {string} path - Upload path
   * @param {string|null} bucket - Bucket name
   * @param {function|null} onProgress - Progress callback
   * @returns {Promise<object>} Upload response
   */
  async upload(file, path, bucket = null, onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    let url = `${API_CONFIG.baseUrl}/files/upload`;
    if (bucket) url += `?bucket=${encodeURIComponent(bucket)}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = (event.loaded / event.total) * 100;
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round(progress),
          });
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            reject(new APIError(
              response.error?.code || 'UPLOAD_FAILED',
              response.error?.message || 'Upload failed',
              xhr.status,
              false
            ));
          }
        } catch (e) {
          reject(new APIError('PARSE_ERROR', 'Failed to parse response', xhr.status, false));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new APIError('NETWORK_ERROR', 'Network error during upload', 0, true));
      });

      xhr.addEventListener('abort', () => {
        reject(new APIError('UPLOAD_ABORTED', 'Upload was aborted', 0, false));
      });

      xhr.open('POST', url);
      
      // Add auth header to XHR
      const authHeader = window.Auth?.getAuthHeader();
      if (authHeader) {
        for (const [key, value] of Object.entries(authHeader)) {
          xhr.setRequestHeader(key, value);
        }
      }
      
      xhr.send(formData);
    });
  },
};

/**
 * Buckets API endpoints
 */
const BucketsAPI = {
  /**
   * Get available buckets
   * @param {boolean} validate - Whether to validate bucket accessibility
   * @returns {Promise<object>} Buckets response
   */
  async list(validate = true) {
    const url = validate 
      ? `${API_CONFIG.baseUrl}/buckets?validate=true`
      : `${API_CONFIG.baseUrl}/buckets`;
    
    return apiRequest('GET', url);
  },

  /**
   * Switch to a different bucket
   * @param {string} bucketName - Bucket name to switch to
   * @returns {Promise<object>} Switch response
   */
  async switch(bucketName) {
    return apiRequest('POST', `${API_CONFIG.baseUrl}/buckets`, {
      bucketName: bucketName,
    });
  },
};

// Export to global scope
window.APIError = APIError;
window.apiRequest = apiRequest;
window.apiRequestWithRetry = apiRequestWithRetry;
window.FilesAPI = FilesAPI;
window.BucketsAPI = BucketsAPI;
window.API_CONFIG = API_CONFIG;
