const SETTINGS_KEY = 'rupt_settings';

const DEFAULT_SETTINGS = {
  roundingMode: 'up', // 'up', 'down', 'none'
  roundingStep: 10, // minutes
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
