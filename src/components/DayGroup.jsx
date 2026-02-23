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
  onDelete,
  onReorderTasks,
}) {
  const [isExpanded, setIsExpanded] = useState(isToday(tasks[0].createdAt));
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

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

  const handleToggleEditMode = (e) => {
    e.stopPropagation();
    setIsEditMode(!isEditMode);
  };

  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, taskId) => {
    e.preventDefault();
    if (draggedTaskId && draggedTaskId !== taskId) {
      setDragOverTaskId(taskId);
    }
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDrop = (e, targetTaskId) => {
    e.preventDefault();
    if (draggedTaskId && draggedTaskId !== targetTaskId) {
      const draggedIndex = sortedTasks.findIndex((t) => t.id === draggedTaskId);
      const targetIndex = sortedTasks.findIndex((t) => t.id === targetTaskId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...sortedTasks];
        const [draggedTask] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedTask);
        
        onReorderTasks(newOrder);
      }
    }
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
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
              className={`btn-edit-mode ${isEditMode ? 'active' : ''}`}
              onClick={handleToggleEditMode}
              title="Editar registros do dia"
            >
              ✏️
            </button>
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
              isEditMode={isEditMode}
              onDelete={() => onDelete(task.id)}
              isDragging={draggedTaskId === task.id}
              isDragOver={dragOverTaskId === task.id}
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, task.id)}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DayGroup;
