/**
 * Utility functions for Axon AI Gateway Admin
 */

const Utils = {
  /**
   * Show a toast notification
   */
  showToast(message, type = 'success') {
    const event = new CustomEvent('show-toast', {
      detail: { message, type }
    });
    window.dispatchEvent(event);
  },
  
  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copied to clipboard!', 'success');
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showToast('Failed to copy to clipboard', 'error');
      return false;
    }
  },
  
  /**
   * Format date/time
   */
  formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  },
  
  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date) {
    if (!date) return 'N/A';
    
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  },
  
  /**
   * Mask sensitive data
   */
  maskKey(key) {
    if (!key || key.length < 8) return '••••••••';
    return `${key.substring(0, 4)}••••${key.substring(key.length - 4)}`;
  },
  
  /**
   * Truncate long strings
   */
  truncate(str, maxLength = 50) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return `${str.substring(0, maxLength)}...`;
  },
  
  /**
   * Download data as JSON file
   */
  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  /**
   * Download data as CSV file
   */
  downloadCSV(data, filename) {
    if (!data || !data.length) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          const stringValue = value === null || value === undefined ? '' : String(value);
          // Escape quotes and wrap in quotes if contains comma
          return stringValue.includes(',') 
            ? `"${stringValue.replace(/"/g, '""')}"` 
            : stringValue;
        }).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  
  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * Parse JSON safely
   */
  safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  },
  
  /**
   * Validate JSON string
   */
  isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  },
  
  /**
   * Sort array by key
   */
  sortBy(array, key, direction = 'asc') {
    return [...array].sort((a, b) => {
      const aVal = key.split('.').reduce((obj, k) => obj?.[k], a);
      const bVal = key.split('.').reduce((obj, k) => obj?.[k], b);
      
      if (aVal === bVal) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      const comparison = aVal < bVal ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  },
  
  /**
   * Filter array by search term across multiple fields
   */
  searchFilter(array, searchTerm, fields) {
    if (!searchTerm) return array;
    const term = searchTerm.toLowerCase();
    return array.filter(item => 
      fields.some(field => {
        const value = field.split('.').reduce((obj, k) => obj?.[k], item);
        return value && String(value).toLowerCase().includes(term);
      })
    );
  },
  
  /**
   * Paginate array
   */
  paginate(array, page, perPage) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return array.slice(start, end);
  },
  
  /**
   * Format bytes to human readable
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
  
  /**
   * Calculate percentage
   */
  percentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  },
  
  /**
   * Generate random color
   */
  randomColor() {
    return `hsl(${Math.random() * 360}, 70%, 60%)`;
  },
  
  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Make Utils available globally
window.Utils = Utils;

