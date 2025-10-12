/**
 * Application Initialization
 * Sets up Alpine.js stores and global state
 */

document.addEventListener('alpine:init', () => {
  // Global application store
  Alpine.store('app', {
    apiKey: localStorage.getItem('axon_api_key') || '',
    showApiKeySetup: !localStorage.getItem('axon_api_key'),
    currentSection: 'dashboard',
    
    setApiKey(key) {
      this.apiKey = key;
      API.setApiKey(key);
      this.showApiKeySetup = false;
      Utils.showToast('API key saved successfully', 'success');
      // Refresh current section
      window.location.reload();
    },
    
    clearApiKey() {
      this.apiKey = '';
      localStorage.removeItem('axon_api_key');
      this.showApiKeySetup = true;
    },
    
    navigateTo(section) {
      this.currentSection = section;
    }
  });
  
  // Toast notification store
  Alpine.store('toasts', {
    items: [],
    
    add(message, type = 'success') {
      const id = Date.now();
      this.items.push({ id, message, type });
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        this.remove(id);
      }, 5000);
    },
    
    remove(id) {
      this.items = this.items.filter(item => item.id !== id);
    }
  });
  
  // Listen for toast events
  window.addEventListener('show-toast', (event) => {
    Alpine.store('toasts').add(event.detail.message, event.detail.type);
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Check if Ctrl/Cmd is pressed
    const modKey = e.ctrlKey || e.metaKey;
    
    if (!modKey) return;
    
    // Navigation shortcuts
    const shortcuts = {
      '1': 'dashboard',
      '2': 'api-keys',
      '3': 'provider-keys',
      '4': 'prompts',
      '5': 'logs',
      '6': 'analytics',
      '7': 'playground'
    };
    
    if (shortcuts[e.key]) {
      e.preventDefault();
      Alpine.store('app').navigateTo(shortcuts[e.key]);
      return;
    }
    
    // Search shortcut (Ctrl/Cmd + K)
    if (e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('input[type="text"]');
      if (searchInput) searchInput.focus();
      return;
    }
    
    // Refresh shortcut (Ctrl/Cmd + R) - prevent default browser refresh
    if (e.key === 'r') {
      e.preventDefault();
      window.location.reload();
      return;
    }
  });
});

