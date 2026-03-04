// Load config module and expose to window
// This file is loaded BEFORE popup.js to ensure ENV_CONFIG is available
(async () => {
  try {
    const module = await import('./config.js');
    window.ENV_CONFIG = module.ENV_CONFIG || {};
    console.log('[Config] Loaded ENV_CONFIG:', !!window.ENV_CONFIG.VITE_GOOGLE_OAUTH_CLIENT_ID);
  } catch (e) {
    console.warn('[Config] Failed to load config.js:', e);
    window.ENV_CONFIG = {};
  }
})();
