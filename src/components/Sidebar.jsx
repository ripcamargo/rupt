import { useState } from 'react';
import { CloseIcon, FolderIcon, SettingsIcon } from './Icons';
import '../styles/Sidebar.css';

function Sidebar({ isOpen, onClose, projects, activeProjectId, onSelectProject, onCreateProject, onDeleteProject, onRenameProject, onOpenProjectSettings }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleCreateProject();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewProjectName('');
    }
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Projetos</h2>
          <button className="sidebar-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="sidebar-content">
          <div className="projects-list">
            {projects.map(project => (
              <div
                key={project.id}
                className={`project-item ${activeProjectId === project.id ? 'active' : ''}`}
              >
                <button
                  className="project-button"
                  onClick={() => onSelectProject(project.id)}
                >
                  <span className="project-icon"><FolderIcon size={18} /></span>
                  <span className="project-name">{project.name}</span>
                  {project.taskCount > 0 && (
                    <span className="project-count">{project.taskCount}</span>
                  )}
                </button>
                <button
                  className="btn-project-settings"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProjectSettings(project.id);
                  }}
                  title="Configurações do projeto"
                >
                  <SettingsIcon size={16} />
                </button>
              </div>
            ))}
          </div>

          {isCreating ? (
            <div className="create-project-form">
              <input
                type="text"
                placeholder="Nome do projeto"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={handleKeyPress}
                autoFocus
                className="project-input"
              />
              <button onClick={handleCreateProject} className="btn-save">✓</button>
              <button onClick={() => { setIsCreating(false); setNewProjectName(''); }} className="btn-cancel">✕</button>
            </div>
          ) : (
            <button className="btn-create-project" onClick={() => setIsCreating(true)}>
              + Criar novo Projeto
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default Sidebar;
