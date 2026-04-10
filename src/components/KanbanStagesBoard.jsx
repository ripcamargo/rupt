import { useState } from 'react';
import TaskItem from './TaskItem';
import '../styles/KanbanStagesBoard.css';

const DEFAULT_STAGES = [
  { id: 'stage-todo', name: 'A Fazer' },
  { id: 'stage-doing', name: 'Em Andamento' },
  { id: 'stage-done', name: 'Concluído' },
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

  const handleDragLeave = () => setDragOverColumn(null);

  const handleDrop = (e, stageId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTaskId) return;
    const task = tasks.find((t) => t.id === draggedTaskId);
    if (!task) return;
    if (task.kanbanStageId !== stageId) {
      onUpdateTask(task.id, 'kanbanStageId', stageId);
    }
    setDraggedTaskId(null);
    setDragOverColumn(null);
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
    };
    onUpdateStages([...stages, newStage]);
    setNewStageName('');
    setIsAddingStage(false);
  };

  return (
    <div className="kanban-stages-board">
      {stages.map((stage, index) => {
        const stageTasks = getTasksForStage(stage.id, index === 0);
        const completedCount = stageTasks.filter((t) => t.status === 'completed').length;
        const activeCount = stageTasks.filter((t) => t.status !== 'completed').length;

        return (
          <div
            key={stage.id}
            className={`kanban-stages-column ${dragOverColumn === stage.id ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
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

                    {confirmDeleteStageId === stage.id && (
                      <div className="stage-delete-confirm">
                        <span className="stage-delete-confirm-text">
                          Excluir “{stage.name}” e suas tarefas?
                        </span>
                        <button
                          className="btn-stage-confirm-delete"
                          onClick={() => handleDeleteStage(stage.id)}
                        >
                          Sim
                        </button>
                        <button
                          className="btn-stage-cancel"
                          onClick={() => setConfirmDeleteStageId(null)}
                        >
                          Não
                        </button>
                      </div>
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
                      onDrop={() => {}}
                      onDragEnd={() => {}}
                      isDefaultProject={isDefaultProject}
                      currentProject={currentProject}
                      currentUserEmail={currentUserEmail}
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
    </div>
  );
}

export default KanbanStagesBoard;
