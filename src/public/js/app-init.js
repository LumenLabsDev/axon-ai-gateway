/**
 * Application Initialization
 * Sets up Alpine.js stores and global state
 */

document.addEventListener('alpine:init', () => {
  // Global application store
  Alpine.store('app', {
    adminKey: localStorage.getItem('axon_admin_key') || '',
    showAdminKeySetup: !localStorage.getItem('axon_admin_key'),
    currentSection: 'dashboard',
    workspaceReady: false,
    currentWorkspaceId: localStorage.getItem('axon_current_workspace') || null,
    
    async initWorkspace() {
      // Load workspaces and set the current one
      if (!this.adminKey || this.showAdminKeySetup) {
        return; // Don't load workspace if not authenticated
      }
      
      try {
        const response = await API.workspaces.list();
        const workspaces = response.data || [];
        
        if (workspaces.length > 0) {
          // Use saved workspace or default to first
          const savedId = localStorage.getItem('axon_current_workspace');
          const workspace = savedId 
            ? workspaces.find(w => w.id === savedId) || workspaces[0]
            : workspaces[0];
          
          this.currentWorkspaceId = workspace.id;
          localStorage.setItem('axon_current_workspace', workspace.id);
        }
      } catch (error) {
        console.error('Failed to initialize workspace:', error);
      } finally {
        this.workspaceReady = true;
      }
    },
    
    setAdminKey(key) {
      this.adminKey = key;
      API.setAdminKey(key);
      this.showAdminKeySetup = false;
      Utils.showToast('Admin key saved successfully', 'success');
      // Refresh current section
      window.location.reload();
    },
    
    clearAdminKey() {
      this.adminKey = '';
      localStorage.removeItem('axon_admin_key');
      localStorage.removeItem('axon_current_workspace');
      this.showAdminKeySetup = true;
      this.workspaceReady = false;
      this.currentWorkspaceId = null;
    },
    
    navigateTo(section) {
      this.currentSection = section;
    }
  });
  
  // Initialize workspace after Alpine is ready
  Alpine.store('app').initWorkspace();
  
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
      '2': 'api-keys',    // Virtual Keys
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

