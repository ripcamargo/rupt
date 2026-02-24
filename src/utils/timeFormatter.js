/**
 * Format seconds to HH:mm:ss
 */
export const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format duration for task display
 */
export const formatDuration = (seconds) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  if (minutes < 60) {
    return `${minutes}m ${secs}s`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return `${hours}h ${remainingMinutes}m`;
};

/**
 * Format duration for editing (HH:mm:ss)
 */
export const formatDurationForEdit = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Parse time string to seconds
 * Accepts formats: HH:mm:ss, HH:mm, mm:ss, or just numbers
 */
export const parseTimeToSeconds = (timeString) => {
  if (!timeString || timeString.trim() === '') return 0;
  
  const trimmed = timeString.trim();
  
  // If it's just a number, treat as seconds
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  
  // Parse time format (HH:mm:ss, HH:mm, or mm:ss)
  const parts = trimmed.split(':').map(p => parseInt(p, 10) || 0);
  
  if (parts.length === 3) {
    // HH:mm:ss
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // mm:ss or HH:mm - assume mm:ss if first part < 60
    if (parts[0] < 60) {
      return parts[0] * 60 + parts[1];
    } else {
      // Treat as HH:mm
      return parts[0] * 3600 + parts[1] * 60;
    }
  } else if (parts.length === 1) {
    // Just a number
    return parts[0];
  }
  
  return 0;
};
