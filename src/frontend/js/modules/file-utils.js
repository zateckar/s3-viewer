/**
 * File Utilities Module
 * Provides common file-related utility functions
 */

/**
 * File type constants
 */
const FILE_ICONS = {
  folder: '📁',
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  txt: '📄',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  gif: '🖼️',
  svg: '🖼️',
  webp: '🖼️',
  bmp: '🖼️',
  ico: '🖼️',
  mp4: '🎬',
  mov: '🎬',
  avi: '🎬',
  mkv: '🎬',
  mp3: '🎵',
  wav: '🎵',
  flac: '🎵',
  ogg: '🎵',
  zip: '📦',
  rar: '📦',
  tar: '📦',
  gz: '📦',
  '7z': '📦',
  js: '📜',
  ts: '📜',
  jsx: '📜',
  tsx: '📜',
  html: '🌐',
  css: '🎨',
  scss: '🎨',
  less: '🎨',
  json: '📋',
  xml: '📋',
  yaml: '📋',
  yml: '📋',
  csv: '📊',
  xls: '📊',
  xlsx: '📊',
  ppt: '📊',
  pptx: '📊',
  default: '📄',
};

/**
 * Image file extensions
 */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];

/**
 * Video file extensions
 */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];

/**
 * Audio file extensions
 */
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'];

/**
 * Document file extensions
 */
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'];

/**
 * Archive file extensions
 */
const ARCHIVE_EXTENSIONS = ['zip', 'rar', 'tar', 'gz', '7z', 'bz2'];

/**
 * Gets the file extension from a filename
 * @param {string} fileName - File name
 * @returns {string} File extension (lowercase)
 */
function getFileExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > -1 ? fileName.substring(lastDot + 1).toLowerCase() : '';
}

/**
 * Gets the file icon for a file or folder
 * @param {string} type - 'file' or 'folder'
 * @param {string} name - File/folder name
 * @returns {string} Emoji icon
 */
function getFileIcon(type, name) {
  if (type === 'folder') {
    return FILE_ICONS.folder;
  }

  const extension = getFileExtension(name);
  return FILE_ICONS[extension] || FILE_ICONS.default;
}

/**
 * Gets file icon from File object
 * @param {File} file - File object
 * @returns {string} Emoji icon
 */
function getFileIconFromFile(file) {
  if (!file) return FILE_ICONS.default;
  
  const extension = getFileExtension(file.name);
  const mimeType = file.type || '';

  // Check MIME type first
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return '📦';

  return FILE_ICONS[extension] || FILE_ICONS.default;
}

/**
 * Checks if a file is an image
 * @param {object} item - File item with name and type properties
 * @returns {boolean} True if file is an image
 */
function isImageFile(item) {
  if (!item || item.type !== 'file') return false;
  const extension = getFileExtension(item.name);
  return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file is a video
 * @param {object} item - File item with name and type properties
 * @returns {boolean} True if file is a video
 */
function isVideoFile(item) {
  if (!item || item.type !== 'file') return false;
  const extension = getFileExtension(item.name);
  return VIDEO_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file is audio
 * @param {object} item - File item with name and type properties
 * @returns {boolean} True if file is audio
 */
function isAudioFile(item) {
  if (!item || item.type !== 'file') return false;
  const extension = getFileExtension(item.name);
  return AUDIO_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file is a document
 * @param {object} item - File item with name and type properties
 * @returns {boolean} True if file is a document
 */
function isDocumentFile(item) {
  if (!item || item.type !== 'file') return false;
  const extension = getFileExtension(item.name);
  return DOCUMENT_EXTENSIONS.includes(extension);
}

/**
 * Checks if a file is an archive
 * @param {object} item - File item with name and type properties
 * @returns {boolean} True if file is an archive
 */
function isArchiveFile(item) {
  if (!item || item.type !== 'file') return false;
  const extension = getFileExtension(item.name);
  return ARCHIVE_EXTENSIONS.includes(extension);
}

/**
 * Gets the file category
 * @param {object} item - File item with name and type properties
 * @returns {string} Category name
 */
function getFileCategory(item) {
  if (!item) return 'unknown';
  if (item.type === 'folder') return 'folder';
  
  if (isImageFile(item)) return 'image';
  if (isVideoFile(item)) return 'video';
  if (isAudioFile(item)) return 'audio';
  if (isDocumentFile(item)) return 'document';
  if (isArchiveFile(item)) return 'archive';
  
  return 'other';
}

/**
 * Formats file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0 || bytes === undefined || bytes === null) return '—';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Formats date for display
 * @param {string|Date} dateString - Date string or Date object
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formats speed for display
 * @param {number} bytesPerSecond - Speed in bytes per second
 * @returns {string} Formatted speed
 */
function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '—';
  return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * Formats time duration for display
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '—';
  
  if (seconds < 60) {
    return Math.round(seconds) + 's';
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Sanitizes a filename for safe display
 * @param {string} fileName - File name to sanitize
 * @returns {string} Sanitized file name
 */
function sanitizeFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  
  // Remove dangerous characters
  let sanitized = fileName.replace(/[\\/:"*?<>|]/g, '');
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  sanitized = sanitized.trim();
  
  return sanitized || 'unnamed_file';
}

/**
 * Truncates filename for display
 * @param {string} fileName - File name to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated file name
 */
function truncateFileName(fileName, maxLength = 30) {
  if (!fileName || fileName.length <= maxLength) return fileName;
  
  const extension = getFileExtension(fileName);
  const nameWithoutExt = extension 
    ? fileName.slice(0, -(extension.length + 1))
    : fileName;
  
  const availableLength = maxLength - extension.length - 4; // 4 for '...' and '.'
  
  if (availableLength <= 0) {
    return fileName.substring(0, maxLength - 3) + '...';
  }
  
  return nameWithoutExt.substring(0, availableLength) + '...' + (extension ? '.' + extension : '');
}

/**
 * Sorts file items (folders first, then alphabetically)
 * @param {Array} items - Array of file items
 * @returns {Array} Sorted items
 */
function sortFileItems(items) {
  if (!Array.isArray(items)) return [];
  
  return [...items].sort((a, b) => {
    // Folders first
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    // Then alphabetically
    return (a.name || '').localeCompare(b.name || '');
  });
}

/**
 * Filters file items by category
 * @param {Array} items - Array of file items
 * @param {string} category - Category to filter by
 * @returns {Array} Filtered items
 */
function filterByCategory(items, category) {
  if (!Array.isArray(items) || !category || category === 'all') {
    return items;
  }
  
  return items.filter(item => getFileCategory(item) === category);
}

/**
 * Filters file items by search query
 * @param {Array} items - Array of file items
 * @param {string} query - Search query
 * @returns {Array} Filtered items
 */
function filterBySearch(items, query) {
  if (!Array.isArray(items) || !query || typeof query !== 'string') {
    return items;
  }
  
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return items;
  
  return items.filter(item => 
    (item.name || '').toLowerCase().includes(lowerQuery)
  );
}

// Export to global scope
window.FileUtils = {
  // Constants
  FILE_ICONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  
  // Functions
  getFileExtension,
  getFileIcon,
  getFileIconFromFile,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isDocumentFile,
  isArchiveFile,
  getFileCategory,
  formatFileSize,
  formatDate,
  formatSpeed,
  formatTime,
  sanitizeFileName,
  truncateFileName,
  sortFileItems,
  filterByCategory,
  filterBySearch,
};

// Also export individual functions for backwards compatibility
window.getFileIcon = getFileIcon;
window.formatFileSize = formatFileSize;
window.formatDate = formatDate;
window.formatSpeed = formatSpeed;
window.formatTime = formatTime;
window.isImageFile = isImageFile;
