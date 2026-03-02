import { useState } from 'react';
import TaskItem from './TaskItem';
import '../styles/KanbanBoard.css';

function KanbanBoard({
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
  onAssignTask,
  currentProject,
  isDefaultProject,
  currentUserEmail,
}) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Get all members including admin
  const allMembers = [];
  
  if (currentProject?.adminEmail) {
    allMembers.push({
      email: currentProject.adminEmail,
      isAdmin: true,
    });
  }
  
  if (currentProject?.members) {
    currentProject.members.forEach(member => {
      // Don't duplicate admin if they're also in members list
      if (member.email !== currentProject.adminEmail) {
        allMembers.push({
          email: member.email,
          isAdmin: false,
        });
      }
    });
  }

  // Group tasks by assignee
  const tasksByMember = {};
  
  allMembers.forEach(member => {
    tasksByMember[member.email] = tasks.filter(
      task => task.assignedTo === member.email
    );
  });

  // Tasks without assignee or assigned to someone not in the project
  const unassignedTasks = tasks.filter(task => {
    if (!task.assignedTo) return true;
    return !allMembers.some(m => m.email === task.assignedTo);
  });

  if (unassignedTasks.length > 0) {
    tasksByMember['Não Atribuído'] = unassignedTasks;
  }

  const handleDragStart = (taskId) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, memberEmail) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(memberEmail);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, memberEmail) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTaskId) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    // Assign task to new member
    const newAssignee = memberEmail === 'Não Atribuído' ? null : memberEmail;
    if (task.assignedTo !== newAssignee) {
      onAssignTask(draggedTaskId, newAssignee);
    }

    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const getMemberDisplayName = (email, isAdmin) => {
    if (email === currentUserEmail) {
      return isAdmin ? 'Eu (ADM)' : 'Eu';
    }
    const name = email?.split('@')[0] || email;
    return isAdmin ? `${name} (ADM)` : name;
  };

  return (
    <div className="kanban-board">
      {Object.entries(tasksByMember).map(([memberEmail, memberTasks]) => {
        const member = allMembers.find(m => m.email === memberEmail);
        const isAdmin = member?.isAdmin || false;
        const displayName = memberEmail === 'Não Atribuído' 
          ? memberEmail 
          : getMemberDisplayName(memberEmail, isAdmin);
        
        const completedCount = memberTasks.filter(t => t.status === 'completed').length;
        const activeCount = memberTasks.filter(t => t.status !== 'completed').length;

        return (
          <div
            key={memberEmail}
            className={`kanban-column ${dragOverColumn === memberEmail ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, memberEmail)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, memberEmail)}
          >
            <div className="kanban-column-header">
              <h3 className="kanban-column-title">{displayName}</h3>
              <div className="kanban-column-stats">
                <span className="stat-active">{activeCount}</span>
                {completedCount > 0 && (
                  <>
                    <span className="stat-separator">•</span>
                    <span className="stat-completed">{completedCount} ✓</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="kanban-column-tasks">
              {memberTasks.length === 0 ? (
                <div className="kanban-empty-state">
                  <p>Nenhuma tarefa</p>
                </div>
              ) : (
                memberTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`kanban-task-wrapper ${draggedTaskId === task.id ? 'dragging' : ''}`}
                    draggable={true}
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
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KanbanBoard;
