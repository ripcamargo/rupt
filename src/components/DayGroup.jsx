import { useState } from 'react';
import { formatDateDisplay, isToday } from '../utils/dateGrouping';
import { formatTime } from '../utils/timeFormatter';
import { downloadLog } from '../utils/logExporter';
import TaskItem from './TaskItem';
import '../styles/DayGroup.css';

function DayGroup({
  dateKey,
  tasks,
  runningTaskId,
  onStart,
  onPause,
  onComplete,
  onToggleUrgent,
  onReopen,
}) {
  const [isExpanded, setIsExpanded] = useState(isToday(tasks[0].createdAt));

  // Calculate total time for the day
  const dayTotal = tasks.reduce(
    (sum, task) => sum + task.totalDurationSeconds,
    0
  );

  // Separate urgent and normal tasks
  const urgentTasks = tasks.filter((t) => t.isUrgent);
  const normalTasks = tasks.filter((t) => !t.isUrgent);

  // Sort by creation time (newest first)
  const sortedTasks = [...urgentTasks, ...normalTasks].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const dateDisplay = formatDateDisplay(tasks[0].createdAt);
  const todayLabel = isToday(tasks[0].createdAt) ? ' (Hoje)' : '';

  const handleDownloadLog = (e) => {
    e.stopPropagation();
    downloadLog(tasks, tasks[0].createdAt);
  };

  return (
    <div className="day-group">
      <button
        className={`day-header ${isExpanded ? 'expanded' : 'collapsed'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="day-header-content">
          <span className="day-date">
            {dateDisplay}
            {todayLabel}
          </span>
          <div className="day-header-actions">
            <span className="day-total">{formatTime(dayTotal)}</span>
            <button
              className="btn-download-log"
              onClick={handleDownloadLog}
              title="Baixar log do dia"
            >
              📥
            </button>
          </div>
        </div>
        <span className={`day-toggle ${isExpanded ? 'open' : 'closed'}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="day-tasks">
          {sortedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isRunning={runningTaskId === task.id}
              elapsedSeconds={0}
              onStart={() => onStart(task.id)}
              onPause={() => onPause(task.id)}
              onComplete={() => onComplete(task.id)}
              onToggleUrgent={() => onToggleUrgent(task.id)}
              onReopen={() => onReopen(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DayGroup;
