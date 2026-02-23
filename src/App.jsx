import { useState, useEffect, useRef } from 'react';
import DayGroup from './components/DayGroup';
import SettingsModal from './components/SettingsModal';
import { formatTime } from './utils/timeFormatter';
import { saveTasks, loadTasks } from './utils/storage';
import { groupTasksByDate } from './utils/dateGrouping';
import { loadSettings, saveSettings } from './utils/settings';
import { roundSeconds } from './utils/rounding';
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
  };

  const reorderTasks = (reorderedTasks) => {
    // Update the tasks array with the new order
    // Keep tasks from other days unchanged
    const reorderedIds = reorderedTasks.map(t => t.id);
    const otherTasks = tasks.filter(t => !reorderedIds.includes(t.id));
    setTasks([...reorderedTasks, ...otherTasks]);
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
              ⚙️
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
        <p>1º Enter: Descrição da tarefa • 2º Enter ou Criar: Nome do solicitante • Clique 🚨 para marcar como urgente</p>
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
