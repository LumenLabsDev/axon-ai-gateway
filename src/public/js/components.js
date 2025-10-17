/**
 * Alpine.js Components for Admin Dashboard
 */

// Helper function to wait for workspace to be ready
const waitForWorkspace = async () => {
  return new Promise((resolve) => {
    const check = () => {
      if (Alpine.store('app').workspaceReady) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
};

document.addEventListener('alpine:init', () => {
  // Dashboard Manager
  Alpine.data('dashboardManager', () => ({
  stats: {
    virtualKeys: 0,
    providerKeys: 0,
    prompts: 0,
    totalRequests: 0
  },
  recentLogs: [],
  loading: true,
  searchTerm: '',

  async init() {
    // Wait for workspace to be ready
    await waitForWorkspace();
    await this.loadStats();
    this.connectToLogStream();
  },

  get filteredLogs() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.recentLogs;
    }

    return this.recentLogs.filter((log) => {
      return ['time', 'method', 'endpoint', 'status'].some((field) => {
        const value = log[field];
        return value && String(value).toLowerCase().includes(term);
      });
    });
  },

  clearSearch() {
    this.searchTerm = '';
    this.$nextTick(() => {
      this.$refs.dashboardSearch?.focus();
    });
  },

  async loadStats() {
    try {
      const [virtualKeysRes, providerKeysRes, promptsRes] = await Promise.all([
        API.virtualKeys.list(),
        API.providerKeys.list(),
        API.prompts.list()
      ]);

      this.stats.virtualKeys = virtualKeysRes.data?.length || 0;
      this.stats.providerKeys = providerKeysRes.data?.length || 0;
      this.stats.prompts = promptsRes.data?.length || 0;
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      this.loading = false;
    }
  },

  connectToLogStream() {
    const logSource = new EventSource('/log/stream');

    logSource.addEventListener('log', (event) => {
      const entry = JSON.parse(event.data);
      this.recentLogs.unshift(entry);
      this.recentLogs = this.recentLogs.slice(0, 20); // Keep the most recent 20 entries for filtering
      this.stats.totalRequests++;
    });

    logSource.onerror = () => {
      console.error('Log stream connection error');
    };
  }
}));

// Virtual Keys Manager
Alpine.data('virtualKeysManager', () => ({
  keys: [],
  providerKeys: [],
  loading: true,
  error: null,
  showCreateModal: false,
  showEditModal: false,
  showCreatedKey: false,
  createdKeyValue: '',
  submitting: false,
  selectedKey: null,
  searchTerm: '',
  sortKey: '',
  sortDirection: 'asc',
  currentPage: 1,
  perPage: 10,
  selectedItems: new Set(),
  formData: {
    name: '',
    description: '',
    workspaceId: '',
    providerKeyId: '',
    rateLimitRpm: null,
    rateLimitTpm: null,
    allowedModels: [],
    isActive: true
  },

  async init() {
    await this.loadKeys();
    await this.loadProviderKeys();
    
    // Watch for section changes and reload provider keys when returning to this section
    this.$watch('$store.app.currentSection', (section) => {
      if (section === 'api-keys') {
        this.loadProviderKeys();
      }
    });
  },
  
  get filteredData() {
    let data = this.keys;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(item => 
        ['name', 'description', 'keyHash'].some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }
    
    if (this.sortKey) {
      data = Utils.sortBy(data, this.sortKey, this.sortDirection);
    }
    
    return data;
  },
  
  get paginatedData() {
    return Utils.paginate(this.filteredData, this.currentPage, this.perPage);
  },
  
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.perPage);
  },
  
  get pageNumbers() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    pages.push(1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (total > 1) pages.push(total);
    
    return [...new Set(pages)].sort((a, b) => a - b);
  },
  
  sortBy(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  },
  
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  },
  
  nextPage() {
    this.goToPage(this.currentPage + 1);
  },
  
  prevPage() {
    this.goToPage(this.currentPage - 1);
  },
  
  toggleSelectAll() {
    if (this.selectedItems.size === this.paginatedData.length) {
      this.selectedItems.clear();
    } else {
      this.paginatedData.forEach(item => this.selectedItems.add(item.id));
    }
  },
  
  toggleSelect(id) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  },
  
  isSelected(id) {
    return this.selectedItems.has(id);
  },
  
  clearSelection() {
    this.selectedItems.clear();
  },

  async loadKeys() {
    this.loading = true;
    this.error = null;
    try {
      const response = await API.virtualKeys.list();
      this.keys = response.data || [];
      // Also reload provider keys to ensure button state is current
      await this.loadProviderKeys();
    } catch (err) {
      this.error = err.message;
      Utils.showToast('Failed to load virtual keys: ' + err.message, 'error');
    } finally {
      this.loading = false;
    }
  },

  async loadProviderKeys() {
    try {
      const response = await API.providerKeys.list();
      this.providerKeys = response.data || [];
    } catch (err) {
      console.error('Failed to load provider keys:', err);
      Utils.showToast('Failed to load provider keys: ' + err.message, 'error');
    }
  },

  async createKey() {
    this.submitting = true;
    try {
      // Set workspace ID from current workspace
      const currentWorkspaceId = localStorage.getItem('axon_current_workspace');
      const payload = {
        ...this.formData,
        workspaceId: currentWorkspaceId
      };
      
      const response = await API.virtualKeys.create(payload);
      if (response.data?.plainKey) {
        this.createdKeyValue = response.data.plainKey;
        this.showCreatedKey = true;
        this.showCreateModal = false;
      }
      await this.loadKeys();
      Utils.showToast('Virtual key created successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to create virtual key: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },

  editKey(key) {
    this.selectedKey = key;
    this.formData = {
      name: key.name,
      description: key.description || '',
      workspaceId: key.workspaceId || '',
      providerKeyId: key.providerKeyId || '',
      rateLimitRpm: key.rateLimitRpm,
      rateLimitTpm: key.rateLimitTpm,
      allowedModels: key.allowedModels || [],
      isActive: key.isActive
    };
    this.showEditModal = true;
  },

  async updateKey() {
    this.submitting = true;
    try {
      // Ensure workspace ID is set
      const currentWorkspaceId = localStorage.getItem('axon_current_workspace');
      const payload = {
        ...this.formData,
        workspaceId: this.formData.workspaceId || currentWorkspaceId
      };
      
      await API.virtualKeys.update(this.selectedKey.id, payload);
      await this.loadKeys();
      this.showEditModal = false;
      Utils.showToast('Virtual key updated successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to update virtual key: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },

  async deleteKey(key) {
    if (!confirm(`Are you sure you want to delete "${key.name}"?`)) return;

    try {
      await API.virtualKeys.delete(key.id);
      await this.loadKeys();
      Utils.showToast('Virtual key deleted successfully', 'success');
    } catch (err) {
      Utils.showToast('Failed to delete API key: ' + err.message, 'error');
    }
  },
  
  async bulkDelete() {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No items selected', 'error');
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected API key(s)?`)) return;
    
    try {
      await Promise.all(
        Array.from(this.selectedItems).map(id => API.virtualKeys.delete(id))
      );
      await this.loadKeys();
      this.clearSelection();
      Utils.showToast(`Deleted ${this.selectedItems.size} API key(s)`, 'success');
    } catch (err) {
      Utils.showToast('Failed to delete some API keys: ' + err.message, 'error');
    }
  },

  resetForm() {
    this.formData = {
      name: '',
      description: '',
      workspaceId: '',
      providerKeyId: '',
      rateLimitRpm: null,
      rateLimitTpm: null,
      allowedModels: [],
      isActive: true
    };
    this.selectedKey = null;
  }
}));

// Provider Keys Manager
Alpine.data('providerKeysManager', () => ({
  keys: [],
  loading: true,
  error: null,
  showCreateModal: false,
  showEditModal: false,
  submitting: false,
  selectedKey: null,
  searchTerm: '',
  sortKey: '',
  sortDirection: 'asc',
  currentPage: 1,
  perPage: 10,
  selectedItems: new Set(),
  formData: {
    name: '',
    provider: '',
    apiKey: ''
  },

  async init() {
    await this.loadKeys();
  },
  
  get filteredData() {
    let data = this.keys;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(item => 
        ['name', 'provider'].some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }
    
    if (this.sortKey) {
      data = Utils.sortBy(data, this.sortKey, this.sortDirection);
    }
    
    return data;
  },
  
  get paginatedData() {
    return Utils.paginate(this.filteredData, this.currentPage, this.perPage);
  },
  
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.perPage);
  },
  
  get pageNumbers() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    pages.push(1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (total > 1) pages.push(total);
    
    return [...new Set(pages)].sort((a, b) => a - b);
  },
  
  sortBy(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  },
  
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  },
  
  nextPage() {
    this.goToPage(this.currentPage + 1);
  },
  
  prevPage() {
    this.goToPage(this.currentPage - 1);
  },
  
  toggleSelectAll() {
    if (this.selectedItems.size === this.paginatedData.length) {
      this.selectedItems.clear();
    } else {
      this.paginatedData.forEach(item => this.selectedItems.add(item.id));
    }
  },
  
  toggleSelect(id) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  },
  
  isSelected(id) {
    return this.selectedItems.has(id);
  },
  
  clearSelection() {
    this.selectedItems.clear();
  },

  async loadKeys() {
    this.loading = true;
    this.error = null;
    try {
      const response = await API.providerKeys.list();
      this.keys = response.data || [];
    } catch (err) {
      this.error = err.message;
      Utils.showToast('Failed to load provider keys: ' + err.message, 'error');
    } finally {
      this.loading = false;
    }
  },

  async createKey() {
    this.submitting = true;
    try {
      await API.providerKeys.create(this.formData);
      await this.loadKeys();
      this.showCreateModal = false;
      Utils.showToast('Provider key added successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to add provider key: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },

  editKey(key) {
    this.selectedKey = key;
    this.formData = {
      name: key.name,
      provider: key.provider,
      apiKey: '' // Don't populate for security
    };
    this.showEditModal = true;
  },

  async updateKey() {
    this.submitting = true;
    try {
      await API.providerKeys.update(this.selectedKey.id, { name: this.formData.name });
      await this.loadKeys();
      this.showEditModal = false;
      Utils.showToast('Provider key updated successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to update provider key: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },

  async deleteKey(key) {
    if (!confirm(`Are you sure you want to delete "${key.name}" (${key.provider})?\n\nThis action cannot be undone.`)) return;

    try {
      await API.providerKeys.delete(key.id);
      await this.loadKeys();
      Utils.showToast('Provider key deleted successfully', 'success');
    } catch (err) {
      Utils.showToast('Failed to delete provider key: ' + err.message, 'error');
    }
  },
  
  async bulkDelete() {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No items selected', 'error');
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected provider key(s)?`)) return;
    
    try {
      await Promise.all(
        Array.from(this.selectedItems).map(id => API.providerKeys.delete(id))
      );
      await this.loadKeys();
      this.clearSelection();
      Utils.showToast(`Deleted ${this.selectedItems.size} provider key(s)`, 'success');
    } catch (err) {
      Utils.showToast('Failed to delete some provider keys: ' + err.message, 'error');
    }
  },

  resetForm() {
    this.formData = {
      name: '',
      provider: '',
      apiKey: ''
    };
    this.selectedKey = null;
  }
}));

// Prompts Manager
Alpine.data('promptsManager', () => ({
  prompts: [],
  loading: true,
  error: null,
  showCreateModal: false,
  showViewModal: false,
  submitting: false,
  selectedPrompt: null,
  searchTerm: '',
  sortKey: '',
  sortDirection: 'asc',
  currentPage: 1,
  perPage: 10,
  selectedItems: new Set(),
  formData: {
    name: '',
    template: '',
    model: '',
    status: 'draft'
  },

  async init() {
    await waitForWorkspace();
    await this.loadPrompts();
  },
  
  get filteredData() {
    let data = this.prompts;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(item => 
        ['name', 'model', 'status'].some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }
    
    if (this.sortKey) {
      data = Utils.sortBy(data, this.sortKey, this.sortDirection);
    }
    
    return data;
  },
  
  get paginatedData() {
    return Utils.paginate(this.filteredData, this.currentPage, this.perPage);
  },
  
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.perPage);
  },
  
  get pageNumbers() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    pages.push(1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (total > 1) pages.push(total);
    
    return [...new Set(pages)].sort((a, b) => a - b);
  },
  
  sortBy(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  },
  
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  },
  
  nextPage() {
    this.goToPage(this.currentPage + 1);
  },
  
  prevPage() {
    this.goToPage(this.currentPage - 1);
  },
  
  toggleSelectAll() {
    if (this.selectedItems.size === this.paginatedData.length) {
      this.selectedItems.clear();
    } else {
      this.paginatedData.forEach(item => this.selectedItems.add(item.id));
    }
  },
  
  toggleSelect(id) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  },
  
  isSelected(id) {
    return this.selectedItems.has(id);
  },
  
  clearSelection() {
    this.selectedItems.clear();
  },

  async loadPrompts() {
    this.loading = true;
    this.error = null;
    try {
      const response = await API.prompts.list();
      this.prompts = response.data || [];
    } catch (err) {
      this.error = err.message;
      Utils.showToast('Failed to load prompts: ' + err.message, 'error');
    } finally {
      this.loading = false;
    }
  },

  async createPrompt() {
    this.submitting = true;
    try {
      // Validate JSON if it looks like JSON
      if (this.formData.template.trim().startsWith('[') || this.formData.template.trim().startsWith('{')) {
        if (!Utils.isValidJSON(this.formData.template)) {
          Utils.showToast('Invalid JSON template', 'error');
          this.submitting = false;
          return;
        }
      }

      await API.prompts.create(this.formData);
      await this.loadPrompts();
      this.showCreateModal = false;
      Utils.showToast('Prompt created successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to create prompt: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },

  viewPrompt(prompt) {
    this.selectedPrompt = prompt;
    this.showViewModal = true;
  },

  async deletePrompt(prompt) {
    if (!confirm(`Are you sure you want to delete "${prompt.name}"?\n\nThis will delete all versions of this prompt.`)) return;

    try {
      await API.prompts.delete(prompt.id);
      await this.loadPrompts();
      Utils.showToast('Prompt deleted successfully', 'success');
    } catch (err) {
      Utils.showToast('Failed to delete prompt: ' + err.message, 'error');
    }
  },
  
  async bulkDelete() {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No items selected', 'error');
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected prompt(s)?`)) return;
    
    try {
      await Promise.all(
        Array.from(this.selectedItems).map(id => API.prompts.delete(id))
      );
      await this.loadPrompts();
      this.clearSelection();
      Utils.showToast(`Deleted ${this.selectedItems.size} prompt(s)`, 'success');
    } catch (err) {
      Utils.showToast('Failed to delete some prompts: ' + err.message, 'error');
    }
  },

  resetForm() {
    this.formData = {
      name: '',
      template: '',
      model: '',
      status: 'draft'
    };
    this.selectedPrompt = null;
  }
}));

// Logs Manager
Alpine.data('logsManager', () => ({
  logs: [],
  searchTerm: '',
  filterStatus: '',
  showDetailsModal: false,
  selectedLog: null,
  sortKey: '',
  sortDirection: 'desc',
  currentPage: 1,
  perPage: 10,
  selectedItems: new Set(),

  init() {
    this.connectToLogStream();
  },
  
  loadLogs() {
    // Refresh connection
    this.logs = [];
    Utils.showToast('Logs refreshed', 'success');
  },

  connectToLogStream() {
    const logSource = new EventSource('/log/stream');

    logSource.addEventListener('connected', (event) => {
      console.log('Connected to log stream');
    });

    logSource.addEventListener('log', (event) => {
      const entry = JSON.parse(event.data);
      entry.id = Date.now() + Math.random(); // Add unique ID
      this.logs.unshift(entry);
      // Keep max 1000 logs in memory
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(0, 1000);
      }
    });

    logSource.onerror = (error) => {
      console.error('Log stream error:', error);
      setTimeout(() => this.connectToLogStream(), 5000);
    };
  },

  get filteredData() {
    let filtered = this.logs;

    // Filter by search term
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.endpoint?.toLowerCase().includes(term) ||
        log.method?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (this.filterStatus) {
      const statusPrefix = this.filterStatus.charAt(0);
      filtered = filtered.filter(log => 
        String(log.status).startsWith(statusPrefix)
      );
    }
    
    // Apply sorting
    if (this.sortKey) {
      filtered = Utils.sortBy(filtered, this.sortKey, this.sortDirection);
    }

    return filtered;
  },
  
  get filteredLogs() {
    return this.filteredData;
  },
  
  get paginatedData() {
    return Utils.paginate(this.filteredData, this.currentPage, this.perPage);
  },
  
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.perPage);
  },
  
  get pageNumbers() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    pages.push(1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (total > 1) pages.push(total);
    
    return [...new Set(pages)].sort((a, b) => a - b);
  },
  
  sortBy(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  },
  
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  },
  
  nextPage() {
    this.goToPage(this.currentPage + 1);
  },
  
  prevPage() {
    this.goToPage(this.currentPage - 1);
  },
  
  toggleSelectAll() {
    if (this.selectedItems.size === this.paginatedData.length) {
      this.selectedItems.clear();
    } else {
      this.paginatedData.forEach(item => this.selectedItems.add(item.id));
    }
  },
  
  toggleSelect(id) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  },
  
  isSelected(id) {
    return this.selectedItems.has(id);
  },
  
  clearSelection() {
    this.selectedItems.clear();
  },

  viewLogDetails(log) {
    this.selectedLog = log;
    this.showDetailsModal = true;
  },

  clearLogs() {
    if (!confirm('Are you sure you want to clear all logs from the display?')) return;
    this.logs = [];
    this.clearSelection();
    Utils.showToast('Logs cleared', 'success');
  },

  exportLogs(format) {
    if (this.filteredLogs.length === 0) {
      Utils.showToast('No logs to export', 'error');
      return;
    }

    const filename = `axon-logs-${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'json') {
      Utils.downloadJSON(this.filteredLogs, filename);
    } else if (format === 'csv') {
      const csvData = this.filteredLogs.map(log => ({
        time: log.time,
        method: log.method,
        endpoint: log.endpoint,
        status: log.status,
        duration: log.duration
      }));
      Utils.downloadCSV(csvData, filename);
    }

    Utils.showToast(`Logs exported as ${format.toUpperCase()}`, 'success');
  },
  
  exportSelected(format) {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No logs selected', 'error');
      return;
    }
    
    const selectedLogs = this.logs.filter(log => this.selectedItems.has(log.id));
    const filename = `axon-logs-selected-${new Date().toISOString().split('T')[0]}.${format}`;
    
    if (format === 'csv') {
      const csvData = selectedLogs.map(log => ({
        time: log.time,
        method: log.method,
        endpoint: log.endpoint,
        status: log.status,
        duration: log.duration
      }));
      Utils.downloadCSV(csvData, filename);
    } else if (format === 'json') {
      Utils.downloadJSON(selectedLogs, filename);
    }
    
    Utils.showToast(`${this.selectedItems.size} log(s) exported as ${format.toUpperCase()}`, 'success');
  },
  
  async bulkDelete() {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No items selected', 'error');
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected log(s)?`)) return;
    
    try {
      // Remove selected logs from display
      this.logs = this.logs.filter(log => !this.selectedItems.has(log.id));
      const count = this.selectedItems.size;
      this.clearSelection();
      Utils.showToast(`Deleted ${count} log(s)`, 'success');
    } catch (err) {
      Utils.showToast('Failed to delete logs: ' + err.message, 'error');
    }
  }
}));

// Analytics Manager
Alpine.data('analyticsManager', () => ({
  loading: true,
  stats: {
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    totalTokens: 0,
    requestsByModel: {},
    requestsByStatus: {},
    recentActivity: []
  },
  timeRange: '24h',
  
  async init() {
    await waitForWorkspace();
    await this.loadAnalytics();
  },
  
  async loadAnalytics() {
    this.loading = true;
    try {
      const response = await API.analytics.get(this.timeRange);
      
      if (response.status === 'success' && response.data) {
        const data = response.data;
        
        // Transform API response to match the expected format
        const requestsByModel = {};
        if (data.topModels && Array.isArray(data.topModels)) {
          data.topModels.forEach(item => {
            requestsByModel[item.model] = item.requests;
          });
        }
        
        this.stats = {
          totalRequests: data.totalRequests || 0,
          successRate: data.successRate || 0,
          avgResponseTime: data.avgResponseTime || 0,
          totalTokens: data.totalTokens || 0,
          requestsByModel: requestsByModel,
          requestsByStatus: data.requestsByStatus || {},
          requestsByTimeWindow: data.requestsByTimeWindow || [],
          resourceCounts: data.resourceCounts || {}
        };
      } else {
        // Fallback to empty data
        this.stats = {
          totalRequests: 0,
          successRate: 0,
          avgResponseTime: 0,
          totalTokens: 0,
          requestsByModel: {},
          requestsByStatus: {},
          requestsByTimeWindow: []
        };
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      Utils.showToast('Failed to load analytics: ' + (error.message || 'Unknown error'), 'error');
      
      // Set empty data on error
      this.stats = {
        totalRequests: 0,
        successRate: 0,
        avgResponseTime: 0,
        totalTokens: 0,
        requestsByModel: {},
        requestsByStatus: {},
        requestsByTimeWindow: []
      };
    } finally {
      this.loading = false;
    }
  },
  
  async changeTimeRange(range) {
    this.timeRange = range;
    await this.loadAnalytics();
  }
}));

// Settings Manager
Alpine.data('settingsManager', () => ({
  preferences: {
    theme: 'light',
    itemsPerPage: 10,
    autoRefresh: false,
    refreshInterval: 30,
    notifications: true
  },
  loading: true,
  
  async init() {
    this.loadPreferences();
  },
  
  loadPreferences() {
    const saved = localStorage.getItem('axon_preferences');
    if (saved) {
      try {
        this.preferences = { ...this.preferences, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse preferences', e);
      }
    }
    this.loading = false;
  },
  
  savePreferences() {
    localStorage.setItem('axon_preferences', JSON.stringify(this.preferences));
    Utils.showToast('Settings saved successfully', 'success');
    
    // Apply theme
    if (this.preferences.theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  },
  
  resetToDefaults() {
    if (!confirm('Reset all settings to defaults?')) return;
    
    this.preferences = {
      theme: 'light',
      itemsPerPage: 10,
      autoRefresh: false,
      refreshInterval: 30,
      notifications: true
    };
    
    this.savePreferences();
  }
}));

// Playground Manager
Alpine.data('playgroundManager', () => ({
  loading: false,
  error: null,
  response: null,
  responseTime: 0,
  responseTab: 'formatted',
  apiKey: '',
  endpoint: '/v1/chat/completions',
  requestBody: {
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello! Can you help me?' }
    ],
    prompt: '',
    temperature: 0.7,
    max_tokens: 1000,
    top_p: 1,
    stream: false
  },
  
  addMessage() {
    this.requestBody.messages.push({ role: 'user', content: '' });
  },
  
  removeMessage(index) {
    this.requestBody.messages.splice(index, 1);
  },
  
  async sendRequest() {
    if (!this.apiKey) {
      Utils.showToast('Please enter a virtual key', 'error');
      return;
    }
    
    this.loading = true;
    this.error = null;
    this.response = null;
    
    try {
      const startTime = Date.now();
      
      // Prepare request body based on endpoint
      let body = { ...this.requestBody };
      
      if (this.endpoint !== '/v1/chat/completions') {
        delete body.messages;
      }
      if (this.endpoint !== '/v1/completions') {
        delete body.prompt;
      }
      
      // Make the request
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });
      
      this.responseTime = Date.now() - startTime;
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || data.message || 'Request failed');
      }
      
      this.response = data;
      Utils.showToast('Request completed successfully', 'success');
    } catch (err) {
      this.error = err.message || 'An error occurred';
      Utils.showToast('Request failed: ' + this.error, 'error');
    } finally {
      this.loading = false;
    }
  },
  
  loadExample(type) {
    if (type === 'chat') {
      this.endpoint = '/v1/chat/completions';
      this.requestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Write a haiku about coding.' }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        stream: false
      };
    } else if (type === 'completion') {
      this.endpoint = '/v1/completions';
      this.requestBody = {
        model: 'gpt-3.5-turbo-instruct',
        prompt: 'Once upon a time',
        temperature: 0.7,
        max_tokens: 100,
        top_p: 1,
        stream: false
      };
    }
    this.response = null;
    this.error = null;
  },
  
  clearAll() {
    this.response = null;
    this.error = null;
    this.requestBody = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: '' }],
      prompt: '',
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
      stream: false
    };
  },
  
  get curlCommand() {
    const apiKey = this.apiKey || 'YOUR_API_KEY';
    
    let body = { ...this.requestBody };
    if (this.endpoint !== '/v1/chat/completions') {
      delete body.messages;
    }
    if (this.endpoint !== '/v1/completions') {
      delete body.prompt;
    }
    
    return `curl ${window.location.origin}${this.endpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '${JSON.stringify(body, null, 2)}'`;
  }
}));

// Workspaces Manager (used in top bar selector)
Alpine.data('workspacesManager', () => ({
  workspaces: [],
  currentWorkspace: null,
  loading: true,
  showCreateModal: false,
  showAdminKeyModal: false,
  createdAdminKey: '',
  submitting: false,
  formData: {
    name: '',
    description: ''
  },
  
  async init() {
    await this.loadWorkspaces();
  },
  
  async loadWorkspaces() {
    this.loading = true;
    try {
      const response = await API.workspaces.list();
      this.workspaces = response.data || [];
      
      // Load current workspace from localStorage
      const savedId = localStorage.getItem('axon_current_workspace');
      if (savedId && this.workspaces.length > 0) {
        this.currentWorkspace = this.workspaces.find(w => w.id === savedId) || this.workspaces[0];
      } else if (this.workspaces.length > 0) {
        this.currentWorkspace = this.workspaces[0];
        // Save the first workspace as current workspace
        localStorage.setItem('axon_current_workspace', this.currentWorkspace.id);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      this.loading = false;
    }
  },
  
  async createWorkspace() {
    if (!this.formData.name) {
      Utils.showToast('Workspace name is required', 'error');
      return;
    }
    
    this.submitting = true;
    try {
      const response = await API.workspaces.create(this.formData);
      await this.loadWorkspaces();
      this.showCreateModal = false;
      
      // Show admin key modal
      if (response.data?.adminKey?.plainKey) {
        this.createdAdminKey = response.data.adminKey.plainKey;
        this.showAdminKeyModal = true;
      }
      
      Utils.showToast('Workspace created successfully', 'success');
      this.resetForm();
    } catch (error) {
      Utils.showToast('Failed to create workspace: ' + error.message, 'error');
    } finally {
      this.submitting = false;
    }
  },
  
  switchWorkspace(workspace) {
    this.currentWorkspace = workspace;
    localStorage.setItem('axon_current_workspace', workspace.id);
    Utils.showToast(`Switched to workspace: ${workspace.name}`, 'success');
    // Reload the page to fetch data for the new workspace
    setTimeout(() => window.location.reload(), 500);
  },
  
  resetForm() {
    this.formData = { name: '', description: '' };
  }
}));

// Workspaces Manager Section (full management page)
Alpine.data('workspacesManagerSection', () => ({
  workspaces: [],
  loading: true,
  error: null,
  showCreateModal: false,
  showEditModal: false,
  showAdminKeyModal: false,
  createdAdminKey: '',
  submitting: false,
  selectedWorkspace: null,
  searchTerm: '',
  sortKey: 'name',
  sortDirection: 'asc',
  currentPage: 1,
  perPage: 10,
  selectedItems: new Set(),
  formData: {
    name: '',
    description: ''
  },
  
  async init() {
    await this.loadWorkspaces();
  },
  
  get filteredData() {
    let data = this.workspaces;
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(item => 
        ['name', 'description'].some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }
    
    if (this.sortKey) {
      data = Utils.sortBy(data, this.sortKey, this.sortDirection);
    }
    
    return data;
  },
  
  get paginatedData() {
    return Utils.paginate(this.filteredData, this.currentPage, this.perPage);
  },
  
  get totalPages() {
    return Math.ceil(this.filteredData.length / this.perPage);
  },
  
  get pageNumbers() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    
    pages.push(1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (total > 1) pages.push(total);
    
    return [...new Set(pages)].sort((a, b) => a - b);
  },
  
  sortBy(key) {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortDirection = 'asc';
    }
  },
  
  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  },
  
  nextPage() {
    this.goToPage(this.currentPage + 1);
  },
  
  prevPage() {
    this.goToPage(this.currentPage - 1);
  },
  
  toggleSelectAll() {
    if (this.selectedItems.size === this.paginatedData.length) {
      this.selectedItems.clear();
    } else {
      this.paginatedData.forEach(item => this.selectedItems.add(item.id));
    }
  },
  
  toggleSelect(id) {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
  },
  
  isSelected(id) {
    return this.selectedItems.has(id);
  },
  
  clearSelection() {
    this.selectedItems.clear();
  },
  
  async loadWorkspaces() {
    this.loading = true;
    this.error = null;
    try {
      const response = await API.workspaces.list();
      this.workspaces = response.data || [];
    } catch (err) {
      this.error = err.message;
      Utils.showToast('Failed to load workspaces: ' + err.message, 'error');
    } finally {
      this.loading = false;
    }
  },
  
  async createWorkspace() {
    if (!this.formData.name) {
      Utils.showToast('Workspace name is required', 'error');
      return;
    }
    
    this.submitting = true;
    try {
      const response = await API.workspaces.create(this.formData);
      await this.loadWorkspaces();
      this.showCreateModal = false;
      
      // Show admin key modal
      if (response.data?.adminKey?.plainKey) {
        this.createdAdminKey = response.data.adminKey.plainKey;
        this.showAdminKeyModal = true;
      }
      
      Utils.showToast('Workspace created successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to create workspace: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },
  
  editWorkspace(workspace) {
    this.selectedWorkspace = workspace;
    this.formData = {
      name: workspace.name,
      description: workspace.description || ''
    };
    this.showEditModal = true;
  },
  
  async updateWorkspace() {
    if (!this.formData.name) {
      Utils.showToast('Workspace name is required', 'error');
      return;
    }
    
    this.submitting = true;
    try {
      await API.workspaces.update(this.selectedWorkspace.id, this.formData);
      await this.loadWorkspaces();
      this.showEditModal = false;
      Utils.showToast('Workspace updated successfully', 'success');
      this.resetForm();
    } catch (err) {
      Utils.showToast('Failed to update workspace: ' + err.message, 'error');
    } finally {
      this.submitting = false;
    }
  },
  
  async deleteWorkspace(workspace) {
    // Prevent deleting current workspace
    const currentWorkspaceId = localStorage.getItem('axon_current_workspace');
    if (workspace.id === currentWorkspaceId) {
      Utils.showToast('Cannot delete the current workspace. Switch to another workspace first.', 'error');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${workspace.name}"?\n\nThis will delete all associated resources including keys, prompts, and logs.\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      await API.workspaces.delete(workspace.id);
      await this.loadWorkspaces();
      Utils.showToast('Workspace deleted successfully', 'success');
    } catch (err) {
      Utils.showToast('Failed to delete workspace: ' + err.message, 'error');
    }
  },
  
  async bulkDelete() {
    if (this.selectedItems.size === 0) {
      Utils.showToast('No workspaces selected', 'error');
      return;
    }
    
    const currentWorkspaceId = localStorage.getItem('axon_current_workspace');
    if (this.selectedItems.has(currentWorkspaceId)) {
      Utils.showToast('Cannot delete the current workspace. Please deselect it first.', 'error');
      return;
    }
    
    if (!confirm(`Delete ${this.selectedItems.size} selected workspace(s)?\n\nThis will delete all associated resources.\n\nThis action cannot be undone.`)) {
      return;
    }
    
    try {
      await Promise.all(
        Array.from(this.selectedItems).map(id => API.workspaces.delete(id))
      );
      await this.loadWorkspaces();
      this.clearSelection();
      Utils.showToast(`Deleted ${this.selectedItems.size} workspace(s)`, 'success');
    } catch (err) {
      Utils.showToast('Failed to delete some workspaces: ' + err.message, 'error');
    }
  },
  
  switchWorkspace(workspace) {
    localStorage.setItem('axon_current_workspace', workspace.id);
    Utils.showToast(`Switched to workspace: ${workspace.name}`, 'success');
    // Reload the page to fetch data for the new workspace
    setTimeout(() => window.location.reload(), 500);
  },
  
  resetForm() {
    this.formData = {
      name: '',
      description: ''
    };
    this.selectedWorkspace = null;
  }
}));

});

