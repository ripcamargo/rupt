/**
 * LocalStorage helpers for persistent task data
 */

const STORAGE_KEY = 'rupt_tasks';
const STORAGE_DATE_KEY = 'rupt_date';

/**
 * Check if we're on a new day
 */
export const isNewDay = () => {
  const storedDate = localStorage.getItem(STORAGE_DATE_KEY);
  const today = new Date().toDateString();
  return storedDate !== today;
};

/**
 * Save tasks to LocalStorage
 */
export const saveTasks = (tasks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_DATE_KEY, new Date().toDateString());
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
};

/**
 * Load tasks from LocalStorage
 */
export const loadTasks = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    
    // If it's a new day, don't load old tasks
    if (isNewDay()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_DATE_KEY, new Date().toDateString());
      return [];
    }
    
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load tasks:', error);
    return [];
  }
};

/**
 * Clear all tasks from LocalStorage
 */
export const clearTasks = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear tasks:', error);
  }
};
