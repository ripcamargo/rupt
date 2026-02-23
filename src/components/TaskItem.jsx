import { formatDuration } from '../utils/timeFormatter';
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
}) {
  const totalSeconds = task.totalDurationSeconds + (isRunning ? elapsedSeconds : 0);

  const startTime = new Date(task.startedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`task-item ${task.status} ${isRunning ? 'running' : ''} ${task.isUrgent ? 'urgent' : ''}`}>
      <div className="task-content">
        <div className="task-info">
          <div className="task-description">
            {task.isUrgent && <span className="urgent-badge">🚨</span>}
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
                Iniciar
              </button>
            ) : (
              <button
                className="btn btn-pause"
                onClick={onPause}
                title="Pausar tarefa"
              >
                Pausar
              </button>
            )}
            <button
              className={`btn btn-urgent ${task.isUrgent ? 'active' : ''}`}
              onClick={onToggleUrgent}
              title="Marcar como urgente"
            >
              🚨
            </button>
            <button
              className="btn btn-complete"
              onClick={onComplete}
              title="Concluir tarefa"
            >
              Concluído
            </button>
          </>
        )}
        {task.status === 'completed' && (
          <>
            <span className="status-badge">✓ Concluído</span>
            <button
              className="btn btn-reopen"
              onClick={onReopen}
              title="Reabrir tarefa"
            >
              Reabrir
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default TaskItem;
