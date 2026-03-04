// Content script that runs on rupt.vercel.app to relay login messages to extension
console.log('[Rupt Extension Content Script] Loaded');

// Listen for messages from the page (from App.jsx)
window.addEventListener('message', (event) => {
  // Only accept messages from the same domain
  if (event.origin !== 'https://rupt.vercel.app') {
    return;
  }

  // Check if this is a login message from the app
  if (event.data && event.data.source === 'rupt-extension-login' && event.data.type === 'LOGIN_SUCCESS') {
    console.log('[Rupt Extension Content Script] Received login message from page:', event.data.type);

    // Forward this message to the extension (to popup/background)
    chrome.runtime.sendMessage({
      type: 'LOGIN_SUCCESS',
      idToken: event.data.idToken,
      user: event.data.user,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Rupt Extension Content Script] Error sending message to extension:', chrome.runtime.lastError);
      } else {
        console.log('[Rupt Extension Content Script] Message sent to extension successfully');
      }
    });
  }
});

console.log('[Rupt Extension Content Script] Message listener registered');
