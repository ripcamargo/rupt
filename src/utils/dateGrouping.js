/**
 * Date formatting and grouping utilities
 */

/**
 * Format date to display format (e.g., "segunda-feira, 20 de fev")
 */
export const formatDateDisplay = (isoString) => {
  const date = new Date(isoString);
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('pt-BR', options);
};

/**
 * Get date key for grouping (YYYY-MM-DD)
 */
export const getDateKey = (isoString) => {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
};

/**
 * Group tasks by date
 */
export const groupTasksByDate = (tasks) => {
  const grouped = {};
  
  tasks.forEach((task) => {
    const dateKey = getDateKey(task.createdAt);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(task);
  });
  
  // Sort by date descending (newest first)
  const sorted = {};
  Object.keys(grouped)
    .sort()
    .reverse()
    .forEach((key) => {
      sorted[key] = grouped[key];
    });
  
  return sorted;
};

/**
 * Check if date is today
 */
export const isToday = (isoString) => {
  const date = new Date(isoString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};
