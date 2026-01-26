/**
 * Notifications Module
 * Provides toast-style notifications with multiple types and auto-dismiss
 */

/**
 * Notification configuration
 */
const NOTIFICATION_CONFIG = {
  defaultDuration: 3000,
  position: 'top-right',
  maxNotifications: 5,
  animations: true,
};

/**
 * Notification types with styling
 */
const NOTIFICATION_TYPES = {
  success: {
    icon: '✅',
    className: 'notification-success',
    duration: 3000,
  },
  error: {
    icon: '❌',
    className: 'notification-error',
    duration: 5000,
  },
  warning: {
    icon: '⚠️',
    className: 'notification-warning',
    duration: 4000,
  },
  info: {
    icon: 'ℹ️',
    className: 'notification-info',
    duration: 3000,
  },
};

/**
 * Active notifications
 */
let activeNotifications = [];
let notificationContainer = null;

/**
 * Creates and returns the notification container
 * @returns {HTMLElement} Notification container element
 */
function getNotificationContainer() {
  if (notificationContainer && document.body.contains(notificationContainer)) {
    return notificationContainer;
  }

  notificationContainer = document.createElement('div');
  notificationContainer.id = 'notification-container';
  notificationContainer.className = `notification-container notification-${NOTIFICATION_CONFIG.position}`;
  notificationContainer.setAttribute('aria-live', 'polite');
  notificationContainer.setAttribute('aria-label', 'Notifications');
  
  document.body.appendChild(notificationContainer);
  return notificationContainer;
}

/**
 * Creates a notification element
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {object} options - Additional options
 * @returns {HTMLElement} Notification element
 */
function createNotificationElement(message, type = 'info', options = {}) {
  const typeConfig = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
  
  const notification = document.createElement('div');
  notification.className = `notification ${typeConfig.className}`;
  notification.setAttribute('role', 'alert');
  
  if (NOTIFICATION_CONFIG.animations) {
    notification.classList.add('notification-enter');
  }

  // Create notification content
  const iconSpan = document.createElement('span');
  iconSpan.className = 'notification-icon';
  iconSpan.textContent = options.icon || typeConfig.icon;
  
  const messageSpan = document.createElement('span');
  messageSpan.className = 'notification-message';
  messageSpan.textContent = message;
  
  const closeButton = document.createElement('button');
  closeButton.className = 'notification-close';
  closeButton.innerHTML = '&times;';
  closeButton.setAttribute('aria-label', 'Close notification');
  closeButton.addEventListener('click', () => dismissNotification(notification));
  
  notification.appendChild(iconSpan);
  notification.appendChild(messageSpan);
  notification.appendChild(closeButton);
  
  // Add action button if provided
  if (options.action) {
    const actionButton = document.createElement('button');
    actionButton.className = 'notification-action';
    actionButton.textContent = options.action.label;
    actionButton.addEventListener('click', () => {
      options.action.handler();
      dismissNotification(notification);
    });
    notification.appendChild(actionButton);
  }

  return notification;
}

/**
 * Dismisses a notification with animation
 * @param {HTMLElement} notification - Notification element to dismiss
 */
function dismissNotification(notification) {
  if (!notification || !notification.parentNode) return;
  
  // Remove from active list
  activeNotifications = activeNotifications.filter(n => n !== notification);
  
  if (NOTIFICATION_CONFIG.animations) {
    notification.classList.remove('notification-enter');
    notification.classList.add('notification-exit');
    
    notification.addEventListener('animationend', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, { once: true });
  } else {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }
}

/**
 * Shows a notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 * @param {object} options - Additional options (duration, icon, action)
 * @returns {HTMLElement} The notification element
 */
function showNotification(message, type = 'info', options = {}) {
  const container = getNotificationContainer();
  const typeConfig = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.info;
  const duration = options.duration ?? typeConfig.duration ?? NOTIFICATION_CONFIG.defaultDuration;
  
  // Limit max notifications
  while (activeNotifications.length >= NOTIFICATION_CONFIG.maxNotifications) {
    const oldest = activeNotifications.shift();
    dismissNotification(oldest);
  }
  
  const notification = createNotificationElement(message, type, options);
  container.appendChild(notification);
  activeNotifications.push(notification);
  
  // Trigger enter animation
  if (NOTIFICATION_CONFIG.animations) {
    requestAnimationFrame(() => {
      notification.classList.add('notification-visible');
    });
  }
  
  // Auto-dismiss after duration
  if (duration > 0 && !options.persistent) {
    setTimeout(() => {
      dismissNotification(notification);
    }, duration);
  }
  
  return notification;
}

/**
 * Shows a success notification
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @returns {HTMLElement} The notification element
 */
function showSuccess(message, options = {}) {
  return showNotification(message, 'success', options);
}

/**
 * Shows an error notification
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @returns {HTMLElement} The notification element
 */
function showError(message, options = {}) {
  return showNotification(message, 'error', options);
}

/**
 * Shows a warning notification
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @returns {HTMLElement} The notification element
 */
function showWarning(message, options = {}) {
  return showNotification(message, 'warning', options);
}

/**
 * Shows an info notification
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @returns {HTMLElement} The notification element
 */
function showInfo(message, options = {}) {
  return showNotification(message, 'info', options);
}

/**
 * Clears all notifications
 */
function clearAllNotifications() {
  const toRemove = [...activeNotifications];
  toRemove.forEach(notification => dismissNotification(notification));
}

/**
 * Injects notification styles if not already present
 */
function injectNotificationStyles() {
  if (document.getElementById('notification-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    .notification-container {
      position: fixed;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      pointer-events: none;
    }
    
    .notification-top-right {
      top: 0;
      right: 0;
    }
    
    .notification-top-left {
      top: 0;
      left: 0;
    }
    
    .notification-bottom-right {
      bottom: 0;
      right: 0;
    }
    
    .notification-bottom-left {
      bottom: 0;
      left: 0;
    }
    
    .notification {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      background: var(--notification-bg, #333);
      color: var(--notification-color, #fff);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 280px;
      max-width: 400px;
      pointer-events: auto;
      font-size: 14px;
      line-height: 1.4;
    }
    
    .notification-enter {
      animation: notification-slide-in 0.3s ease-out forwards;
      opacity: 0;
      transform: translateX(100%);
    }
    
    .notification-visible {
      opacity: 1;
      transform: translateX(0);
    }
    
    .notification-exit {
      animation: notification-slide-out 0.2s ease-in forwards;
    }
    
    @keyframes notification-slide-in {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    
    @keyframes notification-slide-out {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
    
    .notification-success {
      background: linear-gradient(135deg, #10b981, #059669);
    }
    
    .notification-error {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    
    .notification-warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
    }
    
    .notification-info {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }
    
    .notification-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .notification-message {
      flex: 1;
      word-break: break-word;
    }
    
    .notification-close {
      background: transparent;
      border: none;
      color: inherit;
      font-size: 20px;
      cursor: pointer;
      padding: 0 4px;
      opacity: 0.7;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }
    
    .notification-close:hover {
      opacity: 1;
    }
    
    .notification-action {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: inherit;
      padding: 4px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    
    .notification-action:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `;
  
  document.head.appendChild(style);
}

// Inject styles on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectNotificationStyles);
} else {
  injectNotificationStyles();
}

// Export to global scope
window.Notifications = {
  show: showNotification,
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo,
  clear: clearAllNotifications,
  dismiss: dismissNotification,
  config: NOTIFICATION_CONFIG,
};

// Also export showNotification for backwards compatibility
window.showNotification = showNotification;
