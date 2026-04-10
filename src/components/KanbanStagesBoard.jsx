import { useState } from 'react';
import TaskItem from './TaskItem';
import TaskDetailModal from './TaskDetailModal';
import '../styles/KanbanStagesBoard.css';

const DEFAULT_STAGES = [
  { id: 'stage-todo', name: 'A Fazer', countsTime: true },
  { id: 'stage-doing', name: 'Em Andamento', countsTime: true },
  { id: 'stage-done', name: 'Concluído', countsTime: false },
];

function KanbanStagesBoard({
  tasks,
  runningTaskId,
  onStart,
  onPause,
  onComplete,
  onToggleUrgent,
  onReopen,
  onDelete,
  onUpdateTask,
  onEditTime,
  currentProject,
  isDefaultProject,
  currentUserEmail,
  currentUserDisplayName,
  onUpdateStages,
}) {
  const stages =
    currentProject?.kanbanStages && currentProject.kanbanStages.length > 0
      ? currentProject.kanbanStages
      : DEFAULT_STAGES;

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [editingStageId, setEditingStageId] = useState(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [confirmDeleteStageId, setConfirmDeleteStageId] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  const getTasksForStage = (stageId, isFirst) => {
    if (isFirst) {
      return tasks.filter((t) => !t.kanbanStageId || t.kanbanStageId === stageId);
    }
    return tasks.filter((t) => t.kanbanStageId === stageId);
  };

  const handleDragStart = (taskId) => setDraggedTaskId(taskId);
  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(stageId);
  };

  const handleDragLeave = (e, stageId) => {
    // Only clear drag-over when leaving the column entirely (not entering a child element)
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColumn(null);
  };

  // Core drop logic, usable both from column onDrop and from TaskItem onDrop prop
  const processDropOnStage = (stageId) => {
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;
    if (task.kanbanStageId !== stageId) {
      onUpdateTask(task.id, 'kanbanStageId', stageId);
      const targetStage = stages.find((s) => s.id === stageId);
      if (targetStage?.countsTime === false) {
        onPause(task.id);
      } else {
        onStart(task.id);
      }
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    e.stopPropagation();
    processDropOnStage(stageId);
  };

  const handleRenameStage = (stageId) => {
    if (!editingStageName.trim()) return;
    const updated = stages.map((s) =>
      s.id === stageId ? { ...s, name: editingStageName.trim() } : s
    );
    onUpdateStages(updated);
    setEditingStageId(null);
    setEditingStageName('');
  };

  const handleDeleteStage = (stageId) => {
    if (stages.length <= 1) return;
    const remaining = stages.filter((s) => s.id !== stageId);
    onUpdateStages(remaining);
    tasks
      .filter((t) => t.kanbanStageId === stageId)
      .forEach((t) => onUpdateTask(t.id, 'kanbanStageId', null));
    setConfirmDeleteStageId(null);
  };

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    const newStage = {
      id: `stage-${Date.now()}`,
      name: newStageName.trim(),
      countsTime: true,
    };
    onUpdateStages([...stages, newStage]);
    setNewStageName('');
    setIsAddingStage(false);
  };

  const handleToggleStageTime = (stageId) => {
    const updated = stages.map((s) =>
      s.id === stageId ? { ...s, countsTime: s.countsTime === false ? true : false } : s
    );
    onUpdateStages(updated);
  };

  const stageToDelete = confirmDeleteStageId ? stages.find((s) => s.id === confirmDeleteStageId) : null;

  return (
    <div className="kanban-stages-board">
      {stageToDelete && (
        <div className="stage-delete-overlay" onClick={() => setConfirmDeleteStageId(null)}>
          <div className="stage-delete-overlay-card" onClick={(e) => e.stopPropagation()}>
            <p>Excluir <strong>"{stageToDelete.name}"</strong> e suas tarefas?</p>
            <div className="stage-delete-overlay-actions">
              <button className="btn-stage-confirm-delete" onClick={() => handleDeleteStage(stageToDelete.id)}>Sim</button>
              <button className="btn-stage-cancel" onClick={() => setConfirmDeleteStageId(null)}>Não</button>
            </div>
          </div>
        </div>
      )}
      {stages.map((stage, index) => {
        const stageTasks = getTasksForStage(stage.id, index === 0);
        const completedCount = stageTasks.filter((t) => t.status === 'completed').length;
        const activeCount = stageTasks.filter((t) => t.status !== 'completed').length;

        return (
          <div
            key={stage.id}
            className={`kanban-stages-column ${dragOverColumn === stage.id ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={(e) => handleDragLeave(e, stage.id)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="kanban-stages-column-header">
              {editingStageId === stage.id ? (
                <div className="stage-edit-row">
                  <input
                    className="stage-name-input"
                    value={editingStageName}
                    onChange={(e) => setEditingStageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameStage(stage.id);
                      if (e.key === 'Escape') {
                        setEditingStageId(null);
                        setEditingStageName('');
                      }
                    }}
                    autoFocus
                  />
                  <button
                    className="btn-stage-confirm"
                    onClick={() => handleRenameStage(stage.id)}
                  >
                    ✓
                  </button>
                  <button
                    className="btn-stage-cancel"
                    onClick={() => {
                      setEditingStageId(null);
                      setEditingStageName('');
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="stage-title-row">
                  <h3
                    className="kanban-stages-column-title"
                    onDoubleClick={() => {
                      setEditingStageId(stage.id);
                      setEditingStageName(stage.name);
                    }}
                    title="Duplo clique para renomear"
                  >
                    {stage.name}
                  </h3>
                  <div className="stage-header-actions">
                    <button
                      className={`btn-stage-time ${stage.countsTime === false ? 'stage-time-off' : 'stage-time-on'}`}
                      onClick={() => handleToggleStageTime(stage.id)}
                      title={stage.countsTime === false ? 'Tempo pausado nesta etapa (clique para ativar)' : 'Tempo ativo nesta etapa (clique para pausar)'}
                    >
                      {stage.countsTime === false ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                          <line x1="4" y1="4" x2="20" y2="20"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      )}
                    </button>
                    <div className="kanban-column-stats">
                      <span className="stat-active">{activeCount}</span>
                      {completedCount > 0 && (
                        <>
                          <span className="stat-separator">•</span>
                          <span className="stat-completed">{completedCount} ✓</span>
                        </>
                      )}
                    </div>
                    {stages.length > 1 && (
                      <button
                        className="btn-delete-stage"
                        onClick={() => setConfirmDeleteStageId(stage.id)}
                        title="Remover etapa"
                      >
                        ✕
                      </button>
                    )}


                  </div>
                </div>
              )}
            </div>

            <div className="kanban-stages-column-tasks">
              {stageTasks.length === 0 ? (
                <div className="kanban-stages-empty-state">
                  <p>Nenhuma tarefa</p>
                </div>
              ) : (
                stageTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`kanban-task-wrapper ${draggedTaskId === task.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      if (!draggedTaskId && !e.target.closest('button, select, input, a')) {
                        setSelectedTask(task);
                      }
                    }}
                  >
                    <TaskItem
                      task={task}
                      isRunning={runningTaskId === task.id}
                      elapsedSeconds={0}
                      onStart={() => onStart(task.id)}
                      onPause={() => onPause(task.id)}
                      onComplete={() => onComplete(task.id)}
                      onToggleUrgent={() => onToggleUrgent(task.id)}
                      onReopen={() => onReopen(task.id)}
                      isEditMode={false}
                      onDelete={() => onDelete(task.id)}
                      onUpdateTask={onUpdateTask}
                      onEditTime={onEditTime}
                      isDragging={draggedTaskId === task.id}
                      isDragOver={false}
                      onDragStart={() => {}}
                      onDragOver={() => {}}
                      onDragLeave={() => {}}
                      onDrop={() => processDropOnStage(stage.id)}
                      onDragEnd={() => {}}
                      isDefaultProject={isDefaultProject}
                      currentProject={currentProject}
                      currentUserEmail={currentUserEmail}
                      currentUserDisplayName={currentUserDisplayName}
                      isKanbanView={true}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}

      {/* Add Stage Column */}
      <div className="kanban-stages-add-column">
        {isAddingStage ? (
          <div className="add-stage-form">
            <input
              className="stage-name-input"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Nome da etapa..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStage();
                if (e.key === 'Escape') {
                  setIsAddingStage(false);
                  setNewStageName('');
                }
              }}
              autoFocus
            />
            <div className="add-stage-actions">
              <button className="btn-stage-confirm" onClick={handleAddStage}>
                Criar
              </button>
              <button
                className="btn-stage-cancel"
                onClick={() => {
                  setIsAddingStage(false);
                  setNewStageName('');
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-add-stage" onClick={() => setIsAddingStage(true)}>
            + Adicionar Etapa
          </button>
        )}
      </div>
      {selectedTask && (
        <TaskDetailModal
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          isRunning={runningTaskId === selectedTask.id}
          elapsedSeconds={0}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={onUpdateTask}
          onEditTime={onEditTime}
          onDelete={(id) => { onDelete(id); setSelectedTask(null); }}
          currentProject={currentProject}
          currentUserEmail={currentUserEmail}
          currentUserDisplayName={currentUserDisplayName}
          isDefaultProject={isDefaultProject}
        />
      )}
    </div>
  );
}

export default KanbanStagesBoard;
