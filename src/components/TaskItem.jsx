import { formatDuration } from '../utils/timeFormatter';
import { DragHandleIcon, RemoveIcon, UrgentIcon, PlayIcon, PauseIcon, CheckIcon, ReloadIcon } from './Icons';
import '../styles/TaskItem.css';

function TaskItem({
  task,
  isRunning,
  elapsedSeconds,
  onStart,
  onPause,
  onComplete,
  onToggleUrgent,
  onReopen,
  isEditMode,
  onDelete,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const totalSeconds = task.totalDurationSeconds + (isRunning ? elapsedSeconds : 0);

  const startTime = new Date(task.startedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div 
      className={`task-item ${task.status} ${isRunning ? 'running' : ''} ${task.isUrgent ? 'urgent' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="drag-handle" title="Arrastar para reordenar">
        <DragHandleIcon size={16} />
      </div>
      {isEditMode && (
        <button
          className="btn-delete-task"
          onClick={onDelete}
          title="Excluir registro"
        >
          <RemoveIcon size={18} />
        </button>
      )}
      <div className="task-content">
        <div className="task-info">
          <div className="task-description">
            {task.isUrgent && <span className="urgent-badge"><UrgentIcon size={16} /></span>}
            {task.description}
          </div>
          <div className="task-meta">
            <span className="task-start-time">{startTime}</span>
            {task.requester && (
              <span className="task-requester">
                <span className="requester-name">{task.requester}</span>
              </span>
            )}
          </div>
        </div>
        <div className="task-time">{formatDuration(totalSeconds)}</div>
      </div>

      <div className="task-actions">
        {task.status !== 'completed' && (
          <>
            {!isRunning ? (
              <button
                className="btn btn-start"
                onClick={onStart}
                title="Iniciar tarefa"
              >
                <PlayIcon size={18} />
              </button>
            ) : (
              <button
                className="btn btn-pause"
                onClick={onPause}
                title="Pausar tarefa"
              >
                <PauseIcon size={18} />
              </button>
            )}
            <button
              className={`btn btn-urgent ${task.isUrgent ? 'active' : ''}`}
              onClick={onToggleUrgent}
              title="Marcar como urgente"
            >
              <UrgentIcon size={18} />
            </button>
            <button
              className="btn btn-complete"
              onClick={onComplete}
              title="Concluir tarefa"
            >
              <CheckIcon size={18} />
            </button>
          </>
        )}
        {task.status === 'completed' && (
          <>
            <span className="status-badge"><CheckIcon size={16} /> Concluído</span>
            <button
              className="btn btn-reopen"
              onClick={onReopen}
              title="Reabrir tarefa"
            >
              <ReloadIcon size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TaskItem;
