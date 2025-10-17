/**
 * API Service for Admin Dashboard
 * Handles all API calls to the admin endpoints with authentication
 */

const API = {
  baseUrl: '/v1/admin',
  adminKey: localStorage.getItem('axon_admin_key'),

  // Generic request handler
  async request(endpoint, options = {}) {
    const workspaceId = localStorage.getItem('axon_current_workspace');
    const headers = {
      'Content-Type': 'application/json',
      'x-axon-admin-key': this.adminKey,
      ...options.headers
    };
    
    // Add workspace ID header if available
    if (workspaceId) {
      headers['x-axon-workspace-id'] = workspaceId;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Check for unauthorized access (401 or invalid admin key message)
        const isUnauthorized = response.status === 401 || 
                              errorText.includes('Invalid admin key') ||
                              errorText.includes('Unauthorized');
        
        if (isUnauthorized) {
          // Auto sign-out on unauthorized access
          console.warn('Unauthorized access detected. Signing out...');
          
          // Clear admin key from Alpine store if available
          if (window.Alpine && Alpine.store('app')) {
            Alpine.store('app').clearAdminKey();
            
            // Show notification
            if (Alpine.store('toasts')) {
              Alpine.store('toasts').add('Session expired or invalid admin key. Please sign in again.', 'error');
            }
          }
        }
        
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  // Admin Keys (for admin panel authentication)
  adminKeys: {
    list: () => API.request('/admin-keys'),
    get: (id) => API.request(`/admin-keys/${id}`),
    create: (data) => API.request('/admin-keys', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => API.request(`/admin-keys/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => API.request(`/admin-keys/${id}`, { 
      method: 'DELETE' 
    })
  },

  // Virtual Keys (gateway access with rate limits)
  virtualKeys: {
    list: () => API.request('/virtual-keys'),
    get: (id) => API.request(`/virtual-keys/${id}`),
    create: (data) => API.request('/virtual-keys', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => API.request(`/virtual-keys/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => API.request(`/virtual-keys/${id}`, { 
      method: 'DELETE' 
    })
  },

  // Provider Keys
  providerKeys: {
    list: () => API.request('/provider-keys'),
    get: (id) => API.request(`/provider-keys/${id}`),
    create: (data) => API.request('/provider-keys', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => API.request(`/provider-keys/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => API.request(`/provider-keys/${id}`, { 
      method: 'DELETE' 
    })
  },

  // Prompts
  prompts: {
    list: () => API.request('/prompts'),
    get: (id) => API.request(`/prompts/${id}`),
    create: (data) => API.request('/prompts', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => API.request(`/prompts/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => API.request(`/prompts/${id}`, { 
      method: 'DELETE' 
    }),
    getVersions: (id) => API.request(`/prompts/${id}/versions`),
    createVersion: (id, data) => API.request(`/prompts/${id}/versions`, { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    updateVersion: (id, version, data) => API.request(`/prompts/${id}/versions/${version}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
  },

  // Workspaces
  workspaces: {
    list: () => API.request('/workspaces'),
    get: (id) => API.request(`/workspaces/${id}`),
    create: (data) => API.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => API.request(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    delete: (id) => API.request(`/workspaces/${id}`, {
      method: 'DELETE'
    })
  },

  // Analytics
  analytics: {
    get: (timeRange = '24h') => API.request(`/analytics?timeRange=${timeRange}`)
  },

  logs: {
    list: (params = {}) => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page);
      if (params.pageSize) searchParams.set('pageSize', params.pageSize);
      if (params.search) searchParams.set('search', params.search);
      if (params.status) searchParams.set('status', params.status);

      const queryString = searchParams.toString();
      return API.request(`/logs${queryString ? `?${queryString}` : ''}`);
    },
    get: (id) => API.request(`/logs/${id}`)
  },

  // Update admin key
  setAdminKey(key) {
    this.adminKey = key;
    localStorage.setItem('axon_admin_key', key);
  }
};

