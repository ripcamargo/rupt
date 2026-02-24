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
  const [step, setStep] = useState('description'); // 'description' or 'requester'
  const [tempDescription, setTempDescription] = useState('');
  const [settings, setSettings] = useState(loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const inputRef = useRef(null);
  const lastNotificationRef = useRef({});
  const workHoursNotifiedRef = useRef({ lunch: null, exit: null }); // Track if already notified today

  // Load tasks from storage on mount
  useEffect(() => {
    const savedTasks = loadTasks();
    setTasks(savedTasks);
  }, []);

  // Save tasks to storage whenever they change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Update timer for running task
  useEffect(() => {
    if (!runningTaskId) return;

    const interval = setInterval(() => {
      setTasks((prevTasks) =>
        prevTasks.map((task) => {
          if (task.id === runningTaskId && task.status === 'running') {
            return {
              ...task,
              totalDurationSeconds: task.totalDurationSeconds + 1,
            };
          }
          return task;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
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
    if (input.trim()) {
      if (step === 'description') {
        // First step: save description and move to requester step
        setTempDescription(input.trim());
        setInput('');
        setStep('requester');
      } else {
        // Second step: create task with description and requester
        const newTask = {
          id: Date.now(),
          description: tempDescription,
          requester: input.trim(),
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          totalDurationSeconds: 0,
          status: 'running',
          isUrgent: false,
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
        setInput('');
        setStep('description');
        setTempDescription('');
      }
      inputRef.current?.focus();
    }
  };

  const startTask = (taskId) => {
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

    // Start the new task
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
    // Clear notification reference when task pauses
    delete lastNotificationRef.current[taskId];
  };

  const completeTask = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === taskId) {
          const roundedSeconds = roundSeconds(
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
    }
    // Clear notification reference when task completes
    delete lastNotificationRef.current[taskId];
  };

  const toggleUrgent = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, isUrgent: !task.isUrgent }
          : task
      )
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
    // Create a map for quick lookup of reordered tasks and their new positions
    const reorderedMap = new Map(reorderedTasks.map((task, index) => [task.id, { task, newIndex: index }]));
    
    // Find all indices of reordered tasks in the original array
    const reorderedIndices = [];
    tasks.forEach((task, index) => {
      if (reorderedMap.has(task.id)) {
        reorderedIndices.push(index);
      }
    });
    
    // Build new array: replace reordered tasks at their original positions
    const result = tasks.map((task, index) => {
      if (reorderedMap.has(task.id)) {
        // Find which position this index corresponds to in the reordered group
        const positionInGroup = reorderedIndices.indexOf(index);
        return reorderedTasks[positionInGroup];
      }
      return task;
    });
    
    setTasks(result);
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
  const dateKeys = Object.keys(groupedTasks);

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
              placeholder="Digite a descrição da tarefa e pressione Enter..."
              className="task-input"
              autoFocus
            />
          ) : (
            <div className="task-creation-row">
              <div className="task-preview">
                <span className="task-preview-label">Tarefa:</span>
                <span className="task-preview-text">{tempDescription}</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nome do solicitante..."
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
                tasks={groupedTasks[dateKey]}
                runningTaskId={runningTaskId}
                onStart={startTask}
                onPause={pauseTask}
                onComplete={completeTask}
                onToggleUrgent={toggleUrgent}
                onReopen={reopenTask}
                onDelete={deleteTask}
                onReorderTasks={reorderTasks}
              />
            ))
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>1º Enter: Descrição da tarefa • 2º Enter ou Criar: Nome do solicitante • Clique no ícone de alerta para marcar como urgente</p>
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
