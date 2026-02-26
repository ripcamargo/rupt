import { useState, useEffect, useRef } from 'react';
import DayGroup from './components/DayGroup';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import AuthGate from './components/AuthGate';
import UserProfileModal from './components/UserProfileModal';
import { SettingsIcon } from './components/Icons';
import { formatTime } from './utils/timeFormatter';
import { saveTasks, loadTasks } from './utils/storage';
import { groupTasksByDate, isToday } from './utils/dateGrouping';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './utils/settings';
import { roundSeconds } from './utils/rounding';
import { requestNotificationPermission, notifyTaskReminder } from './utils/notifications';
import { auth } from './utils/firebase';
import { loadUserData, saveUserData } from './utils/firestore';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [step, setStep] = useState('description'); // 'description', 'details', or 'requester'
  const [tempDescription, setTempDescription] = useState('');
  const [tempDetails, setTempDetails] = useState(''); // New: task details field
  const [settings, setSettings] = useState(loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(true);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const inputRef = useRef(null);
  const lastNotificationRef = useRef({});
  const workHoursNotifiedRef = useRef({ lunch: null, exit: null }); // Track if already notified today
  const timerStartRef = useRef(null); // Track when timer started for timestamp-based counting
  const timerBaseDurationRef = useRef(0); // Track base duration when timer starts
  const isHydratingRef = useRef(false);
  const authGateSeenKey = 'rupt_seen_auth_gate';

  const mergeTasks = (localTasks, remoteTasks) => {
    const existingIds = new Set(remoteTasks.map((task) => task.id));
    const merged = [...remoteTasks];
    localTasks.forEach((task) => {
      if (!existingIds.has(task.id)) {
        merged.push(task);
      }
    });
    return merged;
  };

  const mergeSettings = (localSettings, remoteSettings) => ({
    ...DEFAULT_SETTINGS,
    ...localSettings,
    ...(remoteSettings || {}),
  });

  // Load tasks from storage on mount
  useEffect(() => {
    const savedTasks = loadTasks();
    setTasks(savedTasks);
  }, []);

  // Handle Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setUserPhoto(null);
        return;
      }

      if (currentUser) {
        isHydratingRef.current = true;
        const localTasks = loadTasks();
        const localSettings = loadSettings();
        const remoteData = await loadUserData(currentUser.uid);

        if (remoteData) {
          const mergedTasks = mergeTasks(localTasks, remoteData.tasks || []);
          const mergedSettings = mergeSettings(localSettings, remoteData.settings);
          setTasks(mergedTasks);
          setSettings(mergedSettings);
          setUserPhoto(remoteData.photoURL || null);
          saveTasks(mergedTasks);
          saveSettings(mergedSettings);
          await saveUserData(currentUser.uid, {
            tasks: mergedTasks,
            settings: mergedSettings,
            photoURL: remoteData.photoURL,
          });
        } else {
          await saveUserData(currentUser.uid, {
            tasks: localTasks,
            settings: localSettings,
            photoURL: null,
          });
        }

        isHydratingRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // Show auth gate only on the first visit if not logged in
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setShowAuthGate(false);
      return;
    }
    const hasSeen = localStorage.getItem(authGateSeenKey) === 'true';
    if (!hasSeen) {
      setShowAuthGate(true);
    }
  }, [authLoading, user]);

  // Save tasks to storage whenever they change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Update timer for running task using timestamp-based approach
  useEffect(() => {
    if (!runningTaskId) {
      timerStartRef.current = null;
      return;
    }

    // Store the start timestamp
    timerStartRef.current = Date.now();

    const interval = setInterval(() => {
      if (timerStartRef.current) {
        // Calculate elapsed time based on real timestamps
        const currentTime = Date.now();
        const realElapsedMs = currentTime - timerStartRef.current;
        const realElapsedSeconds = Math.floor(realElapsedMs / 1000);
        
        setTasks((prevTasks) =>
          prevTasks.map((task) => {
            if (task.id === runningTaskId && task.status === 'running') {
              return {
                ...task,
                totalDurationSeconds: timerBaseDurationRef.current + realElapsedSeconds,
              };
            }
            return task;
          })
        );
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      timerStartRef.current = null;
    };
  }, [runningTaskId]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if (settings.notificationEnabled) {
      requestNotificationPermission();
    }
  }, [settings.notificationEnabled]);

  // Check for running task and send notifications based on task duration
  useEffect(() => {
    if (!runningTaskId || !settings.notificationEnabled) return;

    const checkAndNotify = () => {
      const runningTask = tasks.find(task => task.id === runningTaskId);
      if (!runningTask) return;

      // Check if we should notify based on task urgency
      const shouldNotify = runningTask.isUrgent 
        ? settings.notifyUrgentTasks 
        : settings.notifyCommonTasks;
      
      if (!shouldNotify) return;

      // Check if we should play sound based on task urgency
      const shouldPlaySound = runningTask.isUrgent
        ? settings.soundUrgentTasks
        : settings.soundCommonTasks;

      const intervalSeconds = settings.notificationInterval * 60;
      const taskDuration = runningTask.totalDurationSeconds;

      // Initialize: calculate next notification based on current task duration
      if (!lastNotificationRef.current[runningTaskId]) {
        // Find the next interval threshold after current duration
        const intervalsCompleted = Math.floor(taskDuration / intervalSeconds);
        lastNotificationRef.current[runningTaskId] = (intervalsCompleted + 1) * intervalSeconds;
      }

      const nextNotificationAt = lastNotificationRef.current[runningTaskId];

      // Check if task has reached the next notification threshold
      if (taskDuration >= nextNotificationAt) {
        notifyTaskReminder(runningTask.description, shouldPlaySound, runningTask.isUrgent);
        // Update to next threshold
        lastNotificationRef.current[runningTaskId] = nextNotificationAt + intervalSeconds;
      }
    };

    const notificationInterval = setInterval(
      checkAndNotify,
      1000 // Check every second for precision
    );

    return () => clearInterval(notificationInterval);
  }, [runningTaskId, tasks, settings.notificationEnabled, settings.notificationInterval, settings.notifyCommonTasks, settings.notifyUrgentTasks, settings.soundCommonTasks, settings.soundUrgentTasks]);

  // Check for work hours notifications (lunch and exit time)
  useEffect(() => {
    if (!settings.workHoursNotification || !runningTaskId) return;

    const checkWorkHours = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDate = now.toDateString();

      // Reset notifications on new day
      if (workHoursNotifiedRef.current.lunch !== currentDate) {
        workHoursNotifiedRef.current.lunch = null;
      }
      if (workHoursNotifiedRef.current.exit !== currentDate) {
        workHoursNotifiedRef.current.exit = null;
      }

      // Helper function to check if current time is 5 minutes before target
      const isAlmostTime = (targetTime) => {
        const [targetHour, targetMinute] = targetTime.split(':').map(Number);
        const targetDate = new Date(now);
        targetDate.setHours(targetHour, targetMinute, 0, 0);
        
        const fiveMinutesBefore = new Date(targetDate.getTime() - 5 * 60 * 1000);
        const fiveMinutesBeforeTime = `${String(fiveMinutesBefore.getHours()).padStart(2, '0')}:${String(fiveMinutesBefore.getMinutes()).padStart(2, '0')}`;
        
        return currentTime === fiveMinutesBeforeTime;
      };

      // Check lunch time
      if (isAlmostTime(settings.lunchTime) && workHoursNotifiedRef.current.lunch !== currentDate) {
        notifyTaskReminder(
          'Quase hora do almoço! Finalize ou pause suas tarefas.',
          true, // always play sound
          true  // use urgent sound
        );
        workHoursNotifiedRef.current.lunch = currentDate;
      }

      // Check exit time
      if (isAlmostTime(settings.exitTime) && workHoursNotifiedRef.current.exit !== currentDate) {
        notifyTaskReminder(
          'Quase hora de sair! Finalize ou pause suas tarefas.',
          true, // always play sound
          true  // use urgent sound
        );
        workHoursNotifiedRef.current.exit = currentDate;
      }
    };

    // Check every minute
    const workHoursInterval = setInterval(checkWorkHours, 60000);
    
    // Check immediately
    checkWorkHours();

    return () => clearInterval(workHoursInterval);
  }, [runningTaskId, settings.workHoursNotification, settings.lunchTime, settings.exitTime]);

  const syncToFirestore = async (tasksToSync, settingsToSync) => {
    if (!user) return;
    await saveUserData(user.uid, {
      tasks: tasksToSync,
      settings: settingsToSync,
    });
  };

  const createTask = (e) => {
    e.preventDefault();
    if (input.trim() || (step === 'details' && !settings.requireDetails) || (step === 'requester' && !settings.requireRequester)) {
      if (step === 'description') {
        // First step: save description and decide next step
        const description = input.trim();
        setTempDescription(description);
        setInput('');
        
        // Check if we need details step
        if (settings.requireDetails) {
          setStep('details');
        } else {
          setTempDetails('');
          // Check if we need requester step
          if (settings.requireRequester) {
            setStep('requester');
          } else {
            // Create task directly with values
            createTaskWithData(description, '', '');
          }
        }
      } else if (step === 'details') {
        // Second step: save details and move to requester step (or skip if not required)
        const details = input.trim();
        setTempDetails(details);
        setInput('');
        if (settings.requireRequester) {
          setStep('requester');
        } else {
          // Create task without requester
          createTaskWithData(tempDescription, details, '');
        }
      } else {
        // Third step: create task with all data
        createTaskWithData(tempDescription, tempDetails, input.trim());
      }
      inputRef.current?.focus();
    }
  };

  const createTaskWithData = (description, details, requester) => {
    const newTask = {
      id: Date.now(),
      description: description,
      details: details,
      requester: requester,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      totalDurationSeconds: 0,
      status: 'running',
      isUrgent: false,
      customOrderDate: null, // Tracks when manual ordering started for this day
    };

    setTasks((prevTasks) => {
      // Pause current running task if exists
      let updatedTasks = prevTasks;
      if (runningTaskId) {
        updatedTasks = prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        );
      }

      const newTasksList = [newTask, ...updatedTasks];
      // Sync to Firestore
      syncToFirestore(newTasksList, settings);
      return newTasksList;
    });

    setRunningTaskId(newTask.id);
    timerBaseDurationRef.current = 0;
    setInput('');
    setStep('description');
    setTempDescription('');
    setTempDetails('');
  };

  const startTask = (taskId) => {
    // Find the task to get its current duration
    const taskToStart = tasks.find(t => t.id === taskId);
    if (taskToStart) {
      timerBaseDurationRef.current = taskToStart.totalDurationSeconds;
    }

    setTasks((prevTasks) => {
      let updatedTasks = prevTasks;

      // Pause current running task
      if (runningTaskId && runningTaskId !== taskId) {
        updatedTasks = prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        );
      }

      // Start the new task
      updatedTasks = updatedTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'running',
              startedAt: new Date().toISOString(),
            }
          : task
      );

      // Sync to Firestore
      syncToFirestore(updatedTasks, settings);
      return updatedTasks;
    });

    setRunningTaskId(taskId);
  };

  const pauseTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      );
      // Sync to Firestore after pause
      syncToFirestore(updated, settings);
      return updated;
    });
    setRunningTaskId(null);
    timerBaseDurationRef.current = 0;
    // Clear notification reference when task pauses
    delete lastNotificationRef.current[taskId];
  };

  const completeTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) => {
        if (task.id === taskId) {
          // Don't apply rounding if task was manually edited
          const roundedSeconds = task.manuallyEdited 
            ? task.totalDurationSeconds
            : roundSeconds(
                task.totalDurationSeconds,
                settings.roundingMode,
                settings.roundingStep
              );
          return {
            ...task,
            totalDurationSeconds: roundedSeconds,
            status: 'completed',
          };
        }
        return task;
      });
      // Sync to Firestore after complete
      syncToFirestore(updated, settings);
      return updated;
    });
    if (runningTaskId === taskId) {
      setRunningTaskId(null);
      timerBaseDurationRef.current = 0;
    }
    // Clear notification reference when task completes
    delete lastNotificationRef.current[taskId];
  };

  const toggleUrgent = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { 
              ...task, 
              isUrgent: !task.isUrgent,
              // Urgent tasks will automatically position below running due to status sorting
            }
          : task
      )
    );
  };

  const updateTask = (taskId, field, value) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, [field]: value }
          : task
      )
    );
  };

  const editTaskTime = (taskId, newSeconds) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) => {
        if (task.id === taskId) {
          // Add marker to details (description field) if not already present
          const marker = '*Contador manipulado manualmente';
          let newDetails = task.details || '';
          
          if (!newDetails.includes(marker)) {
            // Add marker at the end
            if (newDetails.trim()) {
              newDetails = newDetails.trim() + ' ' + marker;
            } else {
              newDetails = marker;
            }
          }
          
          return {
            ...task,
            totalDurationSeconds: newSeconds,
            manuallyEdited: true,
            details: newDetails,
          };
        }
        return task;
      });
      // Sync to Firestore after manual edit
      syncToFirestore(updated, settings);
      return updated;
    });
  };

  const reopenTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      );
      // Sync to Firestore
      syncToFirestore(updated, settings);
      return updated;
    });
  };

  const deleteTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.filter((task) => task.id !== taskId);
      // Sync to Firestore after delete
      syncToFirestore(updated, settings);
      return updated;
    });
    if (runningTaskId === taskId) {
      setRunningTaskId(null);
    }
    // Clear notification reference when task is deleted
    delete lastNotificationRef.current[taskId];
  };

  const reorderTasks = (reorderedTasks) => {
    setTasks(reorderedTasks);
    // Sync reordering to Firestore
    syncToFirestore(reorderedTasks, settings);
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Sync settings to Firestore
    syncToFirestore(tasks, newSettings);
  };

  const handleOpenAuth = () => {
    localStorage.setItem(authGateSeenKey, 'true');
    setShowAuthGate(false);
    setIsAuthModalOpen(true);
  };

  const handleUseWithoutLogin = () => {
    localStorage.setItem(authGateSeenKey, 'true');
    setShowAuthGate(false);
  };

  const handleResendVerificationEmail = async () => {
    if (!user || isResendingEmail) return;
    
    setIsResendingEmail(true);
    try {
      await sendEmailVerification(user);
      alert('Email de verificação enviado! Verifique sua caixa de entrada.');
    } catch (err) {
      alert('Erro ao enviar email. Tente novamente mais tarde.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleDismissEmailBanner = () => {
    setShowEmailBanner(false);
  };

  const handleReloadUser = async () => {
    if (user) {
      await user.reload();
      setUser({ ...auth.currentUser });
    }
  };

  // Calculate total time today
  const totalTimeToday = tasks.reduce(
    (sum, task) => sum + (isToday(task.createdAt) ? task.totalDurationSeconds : 0),
    0
  );

  // Group tasks by date
  const groupedTasks = groupTasksByDate(tasks);
  
  // Sort tasks within each day with smart ordering
  const sortedGroupedTasks = Object.keys(groupedTasks).reduce((acc, dateKey) => {
    const tasksForDate = groupedTasks[dateKey];
    
    // 1. Running tasks (top absolute)
    const runningTasks = tasksForDate.filter(task => task.status === 'running');
    
    // 2. Urgent tasks (below running)
    const urgentTasks = tasksForDate.filter(
      task => task.status !== 'running' && task.status !== 'completed' && task.isUrgent
    );
    
    // 3. Normal/Paused tasks (draggable, keep their order)
    const normalTasks = tasksForDate.filter(
      task => task.status !== 'running' && task.status !== 'completed' && !task.isUrgent
    );
    
    // 4. Completed tasks (bottom absolute)
    const completedTasks = tasksForDate.filter(task => task.status === 'completed');
    
    // Combine in order
    acc[dateKey] = [...runningTasks, ...urgentTasks, ...normalTasks, ...completedTasks];
    
    return acc;
  }, {});
  
  const dateKeys = Object.keys(sortedGroupedTasks);

  return (
    <div className="app-container">
      <AuthGate
        isOpen={showAuthGate}
        onUseWithoutLogin={handleUseWithoutLogin}
        onSignUp={handleOpenAuth}
      />
      <header className="app-header">
        <div className="header-content">
          <img src="/rupt-logo.png" alt="Rupt" className="app-logo" />
          <div className="total-time">
            <span className="label">Hoje:</span>
            <span className="time">{formatTime(totalTimeToday)}</span>
          </div>
          <div className="header-actions">
            {user ? (
              <div className="user-status" onClick={() => setIsProfileModalOpen(true)} style={{ cursor: 'pointer' }}>
                {userPhoto ? (
                  <img className="user-photo" src={userPhoto} alt="Usuario" />
                ) : (
                  <span className="user-avatar">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="user-name">
                  {user.displayName || user.email}
                </span>
                <button
                  className="btn-settings"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsSettingsOpen(true);
                  }}
                  title="Configurações"
                >
                  <SettingsIcon size={18} />
                </button>
              </div>
            ) : (
              <>
                <button className="btn-auth-ghost" onClick={handleOpenAuth}>
                  Entrar / Cadastre-se
                </button>
                <button
                  className="btn-settings"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Configurações"
                >
                  <SettingsIcon size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {user && !user.emailVerified && showEmailBanner && (
        <div className="email-verification-banner">
          <div className="banner-content">
            <span className="banner-icon">✉️</span>
            <div className="banner-text">
              <strong>Email não verificado</strong>
              <span>Verifique seu email para garantir acesso completo à sua conta.</span>
            </div>
            <div className="banner-actions">
              <button 
                className="banner-btn-resend" 
                onClick={handleResendVerificationEmail}
                disabled={isResendingEmail}
              >
                {isResendingEmail ? 'Enviando...' : 'Reenviar email'}
              </button>
              <button className="banner-btn-reload" onClick={handleReloadUser} title="Já verifiquei">
                ✓
              </button>
              <button className="banner-btn-close" onClick={handleDismissEmailBanner} title="Fechar">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        <form className="task-input-form" onSubmit={createTask}>
          {step === 'description' ? (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite o assunto da tarefa e pressione Enter..."
              className="task-input"
              autoFocus
            />
          ) : step === 'details' ? (
            <div className="task-creation-row">
              <div className="task-preview">
                <span className="task-preview-label">Assunto:</span>
                <span className="task-preview-text">{tempDescription}</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={settings.requireDetails ? "Descrição detalhada..." : "Descrição (opcional)..."}
                className="task-input"
                autoFocus
              />
              <button type="submit" className="btn-create">
                {settings.requireRequester ? 'Avançar' : 'Criar'}
              </button>
            </div>
          ) : (
            <div className="task-creation-row">
              <div className="task-preview">
                <span className="task-preview-label">Assunto:</span>
                <span className="task-preview-text">{tempDescription}</span>
                {tempDetails && (
                  <>
                    <span className="task-preview-label"> • </span>
                    <span className="task-preview-text">{tempDetails}</span>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={settings.requireRequester ? "Nome do solicitante..." : "Solicitante (opcional)..."}
                className="task-input requester-input"
                autoFocus
              />
              <button type="submit" className="btn-create">
                Criar
              </button>
            </div>
          )}
        </form>

        <div className="tasks-list">
          {dateKeys.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma tarefa ainda. Crie uma para começar!</p>
            </div>
          ) : (
            dateKeys.map((dateKey) => (
              <DayGroup
                key={dateKey}
                dateKey={dateKey}
                tasks={sortedGroupedTasks[dateKey]}
                runningTaskId={runningTaskId}
                onStart={startTask}
                onPause={pauseTask}
                onComplete={completeTask}
                onToggleUrgent={toggleUrgent}
                onReopen={reopenTask}
                onDelete={deleteTask}
                onReorderTasks={reorderTasks}
                onUpdateTask={updateTask}
                onEditTime={editTaskTime}
              />
            ))
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          1º Enter: Assunto
          {settings.requireDetails && ' • 2º Enter: Descrição'}
          {settings.requireRequester && ` • ${settings.requireDetails ? '3º' : '2º'} Enter: Solicitante`}
          {' • Duplo clique para editar • Ícone de alerta marca como urgente'}
        </p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        allTasks={tasks}
        isLoggedIn={!!user}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        userPhoto={userPhoto}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}

export default App;
