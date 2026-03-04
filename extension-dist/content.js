// Content script that runs on rupt.vercel.app to relay login messages and sync tasks
console.log('[Rupt Extension Content Script] Loaded');

// Request pending tasks from background and send to app
function syncPendingTasksWithApp() {
  console.log('[Rupt Extension Content Script] Requesting pending tasks from background...');
  
  chrome.runtime.sendMessage({ type: 'GET_PENDING_TASKS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Rupt Extension Content Script] Error getting pending tasks:', chrome.runtime.lastError?.message);
      return;
    }
    
    const pendingTasks = response?.pendingTasks || [];
    console.log('[Rupt Extension Content Script] Received ' + pendingTasks.length + ' pending tasks from background');
    
    if (pendingTasks.length > 0) {
      // Wait a bit for React to mount and attach listeners
      setTimeout(() => {
        console.log('[Rupt Extension Content Script] Sending ' + pendingTasks.length + ' pending tasks to app...');
        window.postMessage({
          source: 'rupt-extension-sync',
          type: 'PENDING_TASKS',
          pendingTasks: pendingTasks
        }, '*');
        console.log('[Rupt Extension Content Script] Sent pending tasks to app');
      }, 500);
    }
  });
}

// Sync tasks when page loads - try multiple times to ensure React is ready
let syncAttempt = 0;
function syncPendingTasksWithApp() {
  syncAttempt++;
  console.log('[Rupt Extension Content Script] Sync attempt #' + syncAttempt + ' - Requesting pending tasks from background...');
  
  chrome.runtime.sendMessage({ type: 'GET_PENDING_TASKS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Rupt Extension Content Script] Error getting pending tasks:', chrome.runtime.lastError?.message);
      return;
    }
    
    const pendingTasks = response?.pendingTasks || [];
    console.log('[Rupt Extension Content Script] Received ' + pendingTasks.length + ' pending tasks from background (attempt #' + syncAttempt + ')');
    
    if (pendingTasks.length > 0) {
      // Try multiple times with increasing delays to ensure React mounted
      const delays = [100, 300, 500, 1000];
      delays.forEach((delay, index) => {
        setTimeout(() => {
          console.log('[Rupt Extension Content Script] Attempt to send tasks after ' + delay + 'ms (try #' + (index + 1) + ')');
          window.postMessage({
            source: 'rupt-extension-sync',
            type: 'PENDING_TASKS',
            pendingTasks: pendingTasks,
            timestamp: Date.now()
          }, '*');
          console.log('[Rupt Extension Content Script] Sent ' + pendingTasks.length + ' pending tasks to app at ' + delay + 'ms');
        }, delay);
      });
    }
  });
}

// Sync on page load
syncPendingTasksWithApp();

// Also sync again after a delay in case page reloads
setTimeout(syncPendingTasksWithApp, 2000);

// Listen for postMessage from the page
window.addEventListener('message', (event) => {
  // Only accept messages from our own window
  if (event.source !== window) return;
  
  console.log('[Rupt Extension Content Script] Received message:', event.data);
  
  // Check if this is a login message from the app
  if (event.data && event.data.source === 'rupt-extension-login' && event.data.type === 'LOGIN_SUCCESS') {
    console.log('[Rupt Extension Content Script] Login message detected, forwarding to extension');
    
    // Forward this message to the extension background script
    chrome.runtime.sendMessage({
      type: 'LOGIN_SUCCESS',
      idToken: event.data.idToken,
      user: event.data.user,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Rupt Extension Content Script] Error sending message to extension:', chrome.runtime.lastError.message);
      } else {
        console.log('[Rupt Extension Content Script] Message sent to extension successfully:', response);
      }
    });
  }
});

console.log('[Rupt Extension Content Script] Message listener registered');