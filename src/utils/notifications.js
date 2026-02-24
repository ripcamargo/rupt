// Request permission for notifications
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return Notification.permission;
  }
  return 'denied';
};

// Send notification
export const sendNotification = (title, options = {}) => {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: '/rupt-logo.png',
          ...options,
        });
      } catch (error) {
        console.error('Erro ao enviar notificação:', error);
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            icon: '/rupt-logo.png',
            ...options,
          });
        }
      });
    }
  }
};

// Play notification sound for common tasks
export const playCommonTaskSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;

  // Create simple beep sound with multiple tones for better perception
  const notes = [440, 550, 440]; // Frequency in Hz
  const noteDuration = 0.15; // Duration in seconds

  notes.forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.value = freq;
    osc.type = 'sine';

    const startTime = now + index * (noteDuration + 0.05);
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + noteDuration);

    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
};

// Play notification sound for urgent tasks (more noticeable)
export const playUrgentTaskSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioContext.currentTime;

  // Create more prominent alert sound with higher frequencies and longer duration
  const notes = [
    { freq: 880, duration: 0.2 },  // Higher frequency
    { freq: 1174, duration: 0.2 }, // Even higher
    { freq: 880, duration: 0.2 },
    { freq: 1174, duration: 0.2 },
    { freq: 880, duration: 0.25 }  // Longer final note
  ];

  let currentTime = now;

  notes.forEach((note, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.value = note.freq;
    osc.type = 'sine';

    const startTime = currentTime;
    const pauseDuration = 0.05;

    // Higher volume for urgent tasks
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);

    osc.start(startTime);
    osc.stop(startTime + note.duration);

    currentTime += note.duration + pauseDuration;
  });
};

// Play notification sound
export const playNotificationSound = (isUrgent = false) => {
  if (isUrgent) {
    playUrgentTaskSound();
  } else {
    playCommonTaskSound();
  }
};

// Send task reminder notification
export const notifyTaskReminder = (taskDescription, soundEnabled = true, isUrgent = false) => {
  if (soundEnabled) {
    playNotificationSound(isUrgent);
  }

  sendNotification('Lembrete de Tarefa', {
    body: `Tarefa em andamento: ${taskDescription}`,
    tag: 'task-reminder',
    requireInteraction: true, // Force notification to stay visible until user interacts
    silent: false, // Don't mark as silent
    renotify: true, // Renotify even with same tag
  });
};
