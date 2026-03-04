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

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'TASK_STARTED') {
    chrome.action.setBadgeText({ text: '⏱️' });
    chrome.action.setBadgeBackgroundColor({ color: '#4adeb9' });
  } else if (request.type === 'TASK_STOPPED') {
    chrome.action.setBadgeText({ text: '' });
  } else if (request.type === 'OPEN_APP') {
    chrome.tabs.create({ url: request.url });
  }
  
  sendResponse({ success: true });
  return true;
});
