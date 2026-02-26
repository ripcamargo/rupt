const SETTINGS_KEY = 'rupt_settings';

export const DEFAULT_SETTINGS = {
  roundingMode: 'up', // 'up', 'down', 'none'
  roundingStep: 10, // minutes
  notificationEnabled: true,
  notificationInterval: 60, // minutes
  notifyCommonTasks: false,
  notifyUrgentTasks: true,
  soundCommonTasks: false,
  soundUrgentTasks: true,
  entryTime: '08:00',
  lunchTime: '12:00',
  exitTime: '17:00',
  workHoursNotification: true, // Enable/disable work hours notifications
  requireDetails: false, // Require task details field
  requireRequester: true, // Require requester field
};

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return DEFAULT_SETTINGS;
}
