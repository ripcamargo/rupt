// Background service worker for Rupt Chrome Extension

// Listen for timer alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('task_timer_')) {
    const taskId = alarm.name.replace('task_timer_', '');
    
    // Send notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Rupt Timer',
      message: 'Timer concluído para a tarefa!',
      priority: 2
    });
    
    // Update badge
    chrome.action.setBadgeText({ text: '' });
  }
});

// Update badge when timer is running
chrome.storage.local.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.runningTask) {
    const runningTask = changes.runningTask.newValue;
    
    if (runningTask) {
      chrome.action.setBadgeText({ text: '⏱️' });
      chrome.action.setBadgeBackgroundColor({ color: '#4adeb9' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Rupt Extension installed');
  
  // Set default badge
  chrome.action.setBadgeText({ text: '' });
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TASK_STARTED') {
    chrome.action.setBadgeText({ text: '⏱️' });
    chrome.action.setBadgeBackgroundColor({ color: '#4adeb9' });
  } else if (request.type === 'TASK_STOPPED') {
    chrome.action.setBadgeText({ text: '' });
  } else if (request.type === 'OPEN_APP') {
    chrome.tabs.create({ url: request.url });
  } else if (request.type === 'LOGIN_SUCCESS') {
    console.log('[Background] Received LOGIN_SUCCESS from content script, saving to storage');
    console.log('[Background] User data:', request.user);
    
    // Save login data to storage so popup can retrieve it when opened
    chrome.storage.local.set({
      pendingLogin: {
        idToken: request.idToken,
        user: request.user,
        timestamp: Date.now()
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Background] Error saving to storage:', chrome.runtime.lastError);
      } else {
        console.log('[Background] ✓ Login data saved to storage successfully');
        // Verify it was saved
        chrome.storage.local.get(['pendingLogin'], (result) => {
          console.log('[Background] ✓ Verification - pendingLogin in storage:', !!result.pendingLogin);
          if (result.pendingLogin) {
            console.log('[Background] ✓ Saved user:', result.pendingLogin.user.email);
          }
        });
      }
    });
    
    // Also try to forward to popup if it's open (but likely closed)
    chrome.runtime.sendMessage(request).catch(err => {
      console.log('[Background] Popup not open to receive message (expected):', err.message);
    });
  }
  
  sendResponse({ success: true });
  return true;
});
