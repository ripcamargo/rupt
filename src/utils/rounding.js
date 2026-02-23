/**
 * Round seconds based on rounding settings
 * @param {number} seconds - Total seconds
 * @param {string} mode - 'up', 'down', or 'none'
 * @param {number} stepMinutes - Step size in minutes (default 10)
 * @returns {number} - Rounded seconds
 */
export function roundSeconds(seconds, mode, stepMinutes = 10) {
  if (mode === 'none') {
    return seconds;
  }

  const stepSeconds = stepMinutes * 60;
  
  if (mode === 'up') {
    return Math.ceil(seconds / stepSeconds) * stepSeconds;
  } else if (mode === 'down') {
    return Math.floor(seconds / stepSeconds) * stepSeconds;
  }

  return seconds;
}
