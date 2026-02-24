import { useState, useEffect, useRef } from 'react';
import DayGroup from './components/DayGroup';
import SettingsModal from './components/SettingsModal';
import { SettingsIcon } from './components/Icons';
import { formatTime } from './utils/timeFormatter';
import { saveTasks, loadTasks } from './utils/storage';
import { groupTasksByDate } from './utils/dateGrouping';
import { loadSettings, saveSettings } from './utils/settings';
import { roundSeconds } from './utils/rounding';
import { requestNotificationPermission, notifyTaskReminder } from './utils/notifications';
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
  const inputRef = useRef(null);
  const lastNotificationRef = useRef({});
  const workHoursNotifiedRef = useRef({ lunch: null, exit: null }); // Track if already notified today
  const timerStartRef = useRef(null); // Track when timer started for timestamp-based counting
  const timerBaseDurationRef = useRef(0); // Track base duration when timer starts

  // Load tasks from storage on mount
  useEffect(() => {
    const savedTasks = loadTasks();
    setTasks(savedTasks);
  }, []);

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

    // Pause current running task
    if (runningTaskId) {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        )
      );
    }

    setTasks((prevTasks) => [newTask, ...prevTasks]);
    setRunningTaskId(newTask.id);
    timerBaseDurationRef.current = 0; // New task starts at 0
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

    // Pause current running task
    if (runningTaskId && runningTaskId !== taskId) {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        )
      );
    }

    // Start the new task - it will automatically go to top due to status sorting
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'running',
              startedAt: new Date().toISOString(),
            }
          : task
      )
    );

    setRunningTaskId(taskId);
  };

  const pauseTask = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      )
    );
    setRunningTaskId(null);
    timerBaseDurationRef.current = 0;
    // Clear notification reference when task pauses
    delete lastNotificationRef.current[taskId];
  };

  const completeTask = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
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
      })
    );
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
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
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
      })
    );
  };

  const reopenTask = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      )
    );
  };

  const deleteTask = (taskId) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
    if (runningTaskId === taskId) {
      setRunningTaskId(null);
    }
    // Clear notification reference when task is deleted
    delete lastNotificationRef.current[taskId];
  };

  const reorderTasks = (reorderedTasks) => {
    setTasks(reorderedTasks);
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Calculate total time today
  const totalTimeToday = tasks.reduce(
    (sum, task) => sum + task.totalDurationSeconds,
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
      <header className="app-header">
        <div className="header-content">
          <img src="/rupt-logo.png" alt="Rupt" className="app-logo" />
          <div className="header-actions">
            <div className="total-time">
              <span className="label">Hoje:</span>
              <span className="time">{formatTime(totalTimeToday)}</span>
            </div>
            <button
              className="btn-settings"
              onClick={() => setIsSettingsOpen(true)}
              title="Configurações"
            >
              <SettingsIcon size={24} />
            </button>
          </div>
        </div>
      </header>

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
      />
    </div>
  );
}

export default App;
