import { useEffect, useState } from 'react';

/**
 * Custom hook for managing task timer
 */
export const useTimer = (taskId, isRunning, onTick) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newValue = prev + 1;
        onTick?.(newValue);
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onTick]);

  const setSeconds = (seconds) => {
    setElapsedSeconds(seconds);
  };

  return { elapsedSeconds, setSeconds };
};
