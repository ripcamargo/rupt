import { formatDuration, formatDurationForEdit, parseTimeToSeconds } from '../utils/timeFormatter';
import { DragHandleIcon, RemoveIcon, UrgentIcon, PlayIcon, PauseIcon, CheckIcon, ReloadIcon } from './Icons';
import { useState } from 'react';
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
  onUpdateTask,
  onEditTime,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const totalSeconds = task.totalDurationSeconds + (isRunning ? elapsedSeconds : 0);

  const startTime = new Date(task.startedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleDoubleClick = (field, value) => {
    if (!isEditMode) return;
    setEditingField(field);
    if (field === 'time') {
      // Format time for editing (HH:mm:ss)
      setEditValue(formatDurationForEdit(task.totalDurationSeconds));
    } else {
      setEditValue(value || '');
    }
  };

  const handleEditBlur = () => {
    if (!editingField) return;
    
    if (editingField === 'time') {
      // Parse time input and update
      const newSeconds = parseTimeToSeconds(editValue);
      if (newSeconds !== task.totalDurationSeconds) {
        onEditTime(task.id, newSeconds);
      }
    } else if (editValue.trim() !== task[editingField]) {
      onUpdateTask(task.id, editingField, editValue.trim());
    }
    
    setEditingField(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditBlur();
    } else if (e.key === 'Escape') {
      setEditingField(null);
      setEditValue('');
    }
  };

  return (
    <div 
      className={`task-item ${task.status} ${isRunning ? 'running' : ''} ${task.isUrgent ? 'urgent' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isEditMode ? 'edit-mode' : ''}`}
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
          <div 
            className={`task-description ${isEditMode ? 'editable' : ''}`}
            onDoubleClick={() => handleDoubleClick('description', task.description)}
          >
            {task.isUrgent && <span className="urgent-badge"><UrgentIcon size={16} /></span>}
            {editingField === 'description' ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditBlur}
                onKeyDown={handleEditKeyDown}
                autoFocus
                className="task-edit-input"
              />
            ) : (
              task.description
            )}
          </div>
          {(task.details || isEditMode) && (
            <div 
              className={`task-details ${isEditMode ? 'editable' : ''}`}
              onDoubleClick={() => handleDoubleClick('details', task.details)}
            >
              {editingField === 'details' ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleEditBlur}
                  onKeyDown={handleEditKeyDown}
                  autoFocus
                  className="task-edit-input"
                  placeholder="Descrição da tarefa"
                />
              ) : (
                task.details || (isEditMode && <span className="placeholder-text">Clique duas vezes para adicionar descrição</span>)
              )}
            </div>
          )}
          <div className="task-meta">
            <span className="task-start-time">{startTime}</span>
            {(task.requester || isEditMode) && (
              <span 
                className={`task-requester ${isEditMode ? 'editable' : ''}`}
                onDoubleClick={() => handleDoubleClick('requester', task.requester)}
              >
                {editingField === 'requester' ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleEditBlur}
                    onKeyDown={handleEditKeyDown}
                    autoFocus
                    className="task-edit-input requester-input"
                    placeholder="Solicitante"
                  />
                ) : (
                  task.requester ? (
                    <span className="requester-name">{task.requester}</span>
                  ) : (
                    isEditMode && <span className="placeholder-text">Clique duas vezes para adicionar solicitante</span>
                  )
                )}
              </span>
            )}
          </div>
        </div>
        <div 
          className={`task-time ${isEditMode ? 'editable' : ''}`}
          onDoubleClick={() => handleDoubleClick('time', task.totalDurationSeconds)}
          title={isEditMode ? 'Clique duas vezes para editar (formato: HH:mm:ss)' : ''}
        >
          {editingField === 'time' ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditBlur}
              onKeyDown={handleEditKeyDown}
              autoFocus
              className="task-edit-input time-input"
              placeholder="HH:mm:ss"
            />
          ) : (
            formatDuration(totalSeconds)
          )}
        </div>
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
