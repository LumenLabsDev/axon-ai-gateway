/**
 * API Service for Admin Dashboard
 * Handles all API calls to the admin endpoints with authentication
 */

const API = {
  baseUrl: '/v1/admin',
  apiKey: localStorage.getItem('axon_api_key'),

  // Generic request handler
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'x-axon-api-key': this.apiKey,
      ...options.headers
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  // API Keys
  apiKeys: {
    list: () => API.request('/api-keys'),
    get: (id) => API.request(`/api-keys/${id}`),
    create: (data) => API.request('/api-keys', { 
      method: 'POST', 
      body: JSON.stringify(data) 
    }),
    update: (id, data) => API.request(`/api-keys/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify(data) 
    }),
    delete: (id) => API.request(`/api-keys/${id}`, { 
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
    })
  },

  // Analytics
  analytics: {
    get: (timeRange = '24h') => API.request(`/analytics?timeRange=${timeRange}`)
  },

  // Update API key
  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('axon_api_key', key);
  }
};

