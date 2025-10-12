/**
 * Template Loader for Admin Dashboard
 * Dynamically loads and injects HTML templates
 */

const TemplateLoader = {
  cache: new Map(),
  
  /**
   * Load a template from the server
   */
  async loadTemplate(templatePath) {
    // Check cache first
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath);
    }
    
    try {
      const response = await fetch(`/public/templates/${templatePath}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${templatePath}`);
      }
      
      const html = await response.text();
      this.cache.set(templatePath, html);
      return html;
    } catch (error) {
      console.error('Template loading error:', error);
      return `<div class="error">Failed to load template: ${templatePath}</div>`;
    }
  },
  
  /**
   * Load and inject all templates on the page
   */
  async loadAll() {
    const placeholders = document.querySelectorAll('[data-template]');
    const loadPromises = [];
    
    for (const placeholder of placeholders) {
      const templatePath = placeholder.getAttribute('data-template');
      const promise = this.loadTemplate(templatePath).then(html => {
        placeholder.innerHTML = html;
        placeholder.removeAttribute('data-template');
      });
      loadPromises.push(promise);
    }
    
    await Promise.all(loadPromises);
  }
};

// Load templates when DOM is ready, before Alpine.js initializes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    await TemplateLoader.loadAll();
  });
} else {
  // DOM already loaded
  TemplateLoader.loadAll();
}

// Make available globally
window.TemplateLoader = TemplateLoader;

