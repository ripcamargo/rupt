import { useState } from 'react';
import { formatDateDisplay, isToday } from '../utils/dateGrouping';
import { formatTime } from '../utils/timeFormatter';
import { EditIcon, ChevronDownIcon } from './Icons';
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
  onUpdateTask,
  onEditTime,
  currentProject,
  isDefaultProject,
  currentUserEmail,
  displayMode = 'LIST',
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

  // Use tasks array as is, maintaining user's custom order
  const sortedTasks = tasks;

  const dateDisplay = formatDateDisplay(tasks[0].createdAt);
  const todayLabel = isToday(tasks[0].createdAt) ? ' (Hoje)' : '';

  const handleToggleEditMode = (e) => {
    e.stopPropagation();
    setIsEditMode(!isEditMode);
  };

  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverTaskId(null);
  };

  const handleDragOverTask = (taskId) => {
    if (!draggedTaskId || draggedTaskId === taskId) {
      if (dragOverTaskId !== null) {
        setDragOverTaskId(null);
      }
      return;
    }

    const draggedTask = sortedTasks.find(t => t.id === draggedTaskId);
    const targetTask = sortedTasks.find(t => t.id === taskId);
    
    // Allow drag between tasks in the same group:
    // 1. Urgent with Urgent
    // 2. Normal/Paused with Normal/Paused
    const bothUrgent = draggedTask?.isUrgent && targetTask?.isUrgent &&
                       draggedTask.status !== 'running' && draggedTask.status !== 'completed' &&
                       targetTask.status !== 'running' && targetTask.status !== 'completed';
    
    const bothNormal = draggedTask && targetTask && 
                       !draggedTask.isUrgent && !targetTask.isUrgent &&
                       draggedTask.status !== 'running' && draggedTask.status !== 'completed' &&
                       targetTask.status !== 'running' && targetTask.status !== 'completed';

    const canDrag = bothUrgent || bothNormal;

    if (canDrag && dragOverTaskId !== taskId) {
      setDragOverTaskId(taskId);
    } else if (!canDrag && dragOverTaskId === taskId) {
      setDragOverTaskId(null);
    }
  };

  const handleDrop = (targetTaskId) => {
    if (!draggedTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }

    const draggedTask = sortedTasks.find(t => t.id === draggedTaskId);
    const targetTask = sortedTasks.find(t => t.id === targetTaskId);

    // Validate both are in the same draggable group
    const bothUrgent = draggedTask?.isUrgent && targetTask?.isUrgent &&
                       draggedTask.status !== 'running' && draggedTask.status !== 'completed' &&
                       targetTask.status !== 'running' && targetTask.status !== 'completed';
    
    const bothNormal = draggedTask && targetTask && 
                       !draggedTask.isUrgent && !targetTask.isUrgent &&
                       draggedTask.status !== 'running' && draggedTask.status !== 'completed' &&
                       targetTask.status !== 'running' && targetTask.status !== 'completed';

    if (bothUrgent || bothNormal) {
      const draggedIndex = sortedTasks.findIndex(t => t.id === draggedTaskId);
      const targetIndex = sortedTasks.findIndex(t => t.id === targetTaskId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...sortedTasks];
        const [draggedTaskObj] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedTaskObj);
        
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
        <span className={`day-toggle ${isExpanded ? 'open' : 'closed'}`}>
          <ChevronDownIcon size={20} />
        </span>
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
              <EditIcon size={20} />
            </button>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className={displayMode === 'BLOCKS' ? 'tasks-blocks-grid' : 'day-tasks'}>
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
              onUpdateTask={onUpdateTask}
              onEditTime={onEditTime}
              isDragging={draggedTaskId === task.id}
              isDragOver={dragOverTaskId === task.id}
              onDragStart={() => handleDragStart(task.id)}
              onDragOver={() => handleDragOverTask(task.id)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(task.id)}
              onDragEnd={handleDragEnd}
              isDefaultProject={isDefaultProject}
              currentProject={currentProject}
              currentUserEmail={currentUserEmail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default DayGroup;
