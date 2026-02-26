/**
 * LocalStorage helpers for persistent task data
 * Now maintains full history across all days
 */

const STORAGE_KEY = 'rupt_tasks';

/**
 * Save tasks to LocalStorage
 * All tasks are saved regardless of date
 */
export const saveTasks = (tasks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error('Failed to save tasks:', error);
  }
};

/**
 * Load tasks from LocalStorage
 * Returns all tasks from history
 */
export const loadTasks = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
