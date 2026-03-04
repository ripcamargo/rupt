// Override document.createElement to intercept script tag creation
const originalCreateElement = document.createElement.bind(document);
document.createElement = function(tagName, options) {
  if (tagName.toLowerCase() === 'script') {
    const script = originalCreateElement('script', options);
    
    // Override the src setter to prevent external script loading
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(script, 'src', {
      set: function(value) {
        console.warn('[CSP Interceptor] Blocked script load:', value);
        // Don't actually set the src to prevent external loading
        return;
      },
      get: function() {
        return this.getAttribute('src') || '';
      },
      configurable: true
    });
    
    return script;
  }
  return originalCreateElement(tagName, options);
};

// Create a mock gapi object to prevent Firebase from trying to load it
window.gapi = {
  load: function(name, callback) {
    console.log('[gapi mock] load called for:', name);
    if (callback && callback.onload) {
      setTimeout(() => callback.onload(), 0);
    } else if (typeof callback === 'function') {
      setTimeout(callback, 0);
    }
  },
  client: {},
  auth2: {
    getAuthInstance: function() {
      return null;
    }
  },
  signin2: {
    render: function() {}
  }
};
