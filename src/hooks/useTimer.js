import { useEffect, useState, useRef } from 'react';

/**
 * Custom hook for managing task timer
 * Uses timestamp-based approach to avoid browser throttling when tab is inactive
 */
export const useTimer = (taskId, isRunning, onTick) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(null);
  const baseSecondsRef = useRef(0);

  useEffect(() => {
    if (!isRunning) {
      startTimeRef.current = null;
      return;
    }

    // Capture the start timestamp
    startTimeRef.current = Date.now();
    baseSecondsRef.current = elapsedSeconds;

    const interval = setInterval(() => {
      if (startTimeRef.current) {
        // Calculate elapsed time based on real timestamps
        const currentTime = Date.now();
        const realElapsedMs = currentTime - startTimeRef.current;
        const realElapsedSeconds = Math.floor(realElapsedMs / 1000);
        const newValue = baseSecondsRef.current + realElapsedSeconds;
        
        setElapsedSeconds(newValue);
        onTick?.(newValue);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onTick]);

  const setSeconds = (seconds) => {
    setElapsedSeconds(seconds);
    baseSecondsRef.current = seconds;
  };

  return { elapsedSeconds, setSeconds };
};
