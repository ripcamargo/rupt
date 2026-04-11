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
  isDefaultProject,
  currentProject,
  currentUserEmail,
  currentUserDisplayName = '',
  isKanbanView = false,
}) {
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  // All project participants: admin first, then other members, deduped by email
  const allParticipants = (() => {
    if (!currentProject || isDefaultProject) return [];
    const seen = new Set();
    const list = [];
    if (currentProject.adminEmail) {
      seen.add(currentProject.adminEmail.toLowerCase());
      const isMe = currentProject.adminEmail.toLowerCase() === currentUserEmail?.toLowerCase();
      const adminMember = currentProject.members?.find(m => m.email?.toLowerCase() === currentProject.adminEmail.toLowerCase());
      const name = isMe
        ? (currentUserDisplayName || adminMember?.name || currentProject.adminEmail.split('@')[0])
        : (currentProject.adminName || adminMember?.name || currentProject.adminEmail.split('@')[0]);
      list.push({ email: currentProject.adminEmail, name });
    }
    (currentProject.members || []).forEach(m => {
      if (m.email && !seen.has(m.email.toLowerCase())) {
        seen.add(m.email.toLowerCase());
        const isMe = m.email.toLowerCase() === currentUserEmail?.toLowerCase();
        const name = isMe
          ? (currentUserDisplayName || m.name || m.email.split('@')[0])
          : (m.name || m.email.split('@')[0]);
        list.push({ email: m.email, name });
      }
    });
    return list;
  })();

  const getDisplayName = (email) => {
    if (!email) return currentUserDisplayName || currentUserEmail?.split('@')[0];
    if (email.toLowerCase() === currentUserEmail?.toLowerCase()) return currentUserDisplayName || currentUserEmail.split('@')[0];
    const p = allParticipants.find(m => m.email.toLowerCase() === email.toLowerCase());
    return p?.name || email.split('@')[0];
  };

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

  const handleDragStartLocal = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    onDragStart();
  };

  const handleDragOverLocal = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver();
  };

  const handleDropLocal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop();
  };

  return (
    <div 
      className={`task-item ${task.status} ${isRunning ? 'running' : ''} ${task.isUrgent ? 'urgent' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isEditMode ? 'edit-mode' : ''} ${isKanbanView ? 'kanban-view' : ''}`}
      draggable={true}
      onDragStart={handleDragStartLocal}
      onDragOver={handleDragOverLocal}
      onDragLeave={onDragLeave}
      onDrop={handleDropLocal}
      onDragEnd={onDragEnd}
    >
      {!isKanbanView && (
        <div className="drag-handle" title="Arrastar para reordenar">
          <DragHandleIcon size={16} />
        </div>
      )}
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
        {isKanbanView ? (
          // Kanban layout: vertical stack
          <>
            {/* 1. Assunto */}
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

            {/* 2. Descrição */}
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

            {/* 3. Solicitante */}
            {(task.requester || isEditMode) && (
              <div 
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
              </div>
            )}

            {/* 4. Responsável e Tempo */}
            {(() => {
              const assignee = task.assignedTo || currentUserEmail;
              const isAssignee = assignee?.toLowerCase() === currentUserEmail?.toLowerCase();
              return (
                <div className="task-time-row">
                  {!isDefaultProject && allParticipants.length > 0 && (
                    <select
                      className="task-assignee-inline-select"
                      value={assignee}
                      onChange={(e) => onUpdateTask(task.id, 'assignedTo', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {allParticipants.map((p) => (
                        <option key={p.email} value={p.email}>{getDisplayName(p.email)}</option>
                      ))}
                    </select>
                  )}
                  {!isDefaultProject && allParticipants.length === 0 && (
                    <span className="task-assignee-inline">
                      {getDisplayName(assignee)}
                    </span>
                  )}
                  {isAssignee && (
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
                        <>Tempo: {formatDuration(totalSeconds)}</>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          // Default layout: horizontal
          <>
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
                {!isDefaultProject && (
                  <span 
                    className="task-assigned-to"
                  >
                    {editingField === 'assignedTo' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditBlur}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                        className="task-edit-select"
                      >
                        {allParticipants.map((p) => (
                          <option key={p.email} value={p.email}>{getDisplayName(p.email)}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        className="task-assignee-select"
                        value={task.assignedTo || currentUserEmail}
                        onChange={(e) => onUpdateTask(task.id, 'assignedTo', e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title="Atribuir responsável"
                      >
                        {allParticipants.map((p) => (
                          <option key={p.email} value={p.email}>{getDisplayName(p.email)}</option>
                        ))}
                      </select>
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
          </>
        )}
      </div>

      <div className="task-actions">
        {(task.assignedTo || currentUserEmail) === currentUserEmail && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

export default TaskItem;
