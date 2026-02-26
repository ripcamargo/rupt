import { useState, useEffect } from 'react';
import { CloseIcon, SettingsIcon } from './Icons';
import '../styles/ProjectSettingsModal.css';

function ProjectSettingsModal({ isOpen, onClose, project, currentUserId, onUpdate, onDelete }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    displayMode: 'LIST',
    color: '#4adeb9',
  });
  const [members, setMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        displayMode: project.displayMode || 'LIST',
        color: project.color || '#4adeb9',
      });
      setMembers(project.members || []);
      setNewMemberEmail('');
    }
  }, [project, isOpen]);

  const isAdmin = currentUserId === project?.adminId;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    if (newMemberEmail.trim() && newMemberEmail.includes('@')) {
      const newMember = {
        email: newMemberEmail.trim().toLowerCase(),
        joinedAt: new Date().toISOString(),
      };
      
      // Check if member already exists
      if (!members.some(m => m.email === newMember.email)) {
        setMembers([...members, newMember]);
        setNewMemberEmail('');
      }
    }
  };

  const handleRemoveMember = (email) => {
    setMembers(members.filter(m => m.email !== email));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    onUpdate({
      ...project,
      ...formData,
      members,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!isAdmin) return;
    if (window.confirm('ATENÇÃO: Esta ação é irreversível. Todos os dados do projeto e suas tarefas serão permanentemente deletados. Tem certeza que deseja continuar?')) {
      onDelete(project.id);
      onClose();
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal project-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Configurações do Projeto</h2>
            {!isAdmin && <span className="badge-viewer">Apenas visualização</span>}
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="modal-content">
          {isAdmin ? (
            <form onSubmit={handleSave} className="project-settings-form">
              {/* Basic Info */}
              <div className="form-section">
                <h3>Informações Básicas</h3>
                
                <div className="form-group">
                  <label htmlFor="project-name">Nome do Projeto *</label>
                  <input
                    id="project-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="form-input"
                    disabled={!isAdmin}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="project-description">Descrição (Opcional)</label>
                  <textarea
                    id="project-description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Descreva o propósito deste projeto..."
                    disabled={!isAdmin}
                  />
                </div>
              </div>

              {/* Display Settings */}
              <div className="form-section">
                <h3>Visualização</h3>
                
                <div className="form-group">
                  <label htmlFor="project-mode">Modo de Exibição</label>
                  <select
                    id="project-mode"
                    name="displayMode"
                    value={formData.displayMode}
                    onChange={handleChange}
                    className="form-select"
                    disabled={!isAdmin}
                  >
                    <option value="LIST">Lista</option>
                    <option value="BLOCKS">Blocos</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="project-color">Cor do Projeto</label>
                  <div className="color-picker-group">
                    <input
                      id="project-color"
                      type="color"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="color-picker"
                      disabled={!isAdmin}
                    />
                    <span 
                      className="color-preview"
                      style={{ backgroundColor: formData.color }}
                    />
                    <span className="color-value">{formData.color}</span>
                    <button
                      type="button"
                      className="btn-reset-color"
                      onClick={() => setFormData(prev => ({ ...prev, color: '#4adeb9' }))}
                      disabled={!isAdmin}
                    >
                      Padrão
                    </button>
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="form-section">
                <h3>Membros do Projeto</h3>
                
                <div className="members-list">
                  <div className="member-item admin">
                    <div className="member-info">
                      <span className="member-email">{project.adminEmail || 'Você (Administrador)'}</span>
                      <span className="member-role">ADM</span>
                    </div>
                  </div>

                  {members.map((member, index) => (
                    <div key={index} className="member-item">
                      <div className="member-info">
                        <span className="member-email">{member.email}</span>
                        <span className="member-role">Convidado</span>
                      </div>
                      <button
                        type="button"
                        className="btn-remove-member"
                        onClick={() => handleRemoveMember(member.email)}
                        title="Remover membro"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-group add-member">
                  <label htmlFor="new-member-email">Adicionar Membro</label>
                  <div className="add-member-input-group">
                    <input
                      id="new-member-email"
                      type="email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddMember(e)}
                      placeholder="Digite o e-mail da pessoa"
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="btn-add-member"
                      onClick={handleAddMember}
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-section form-actions">
                <button type="submit" className="btn-save-settings">
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  className="btn-delete-project"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Apagar Projeto
                </button>
              </div>
            </form>
          ) : (
            <div className="viewer-mode">
              <div className="form-section">
                <h3>Informações do Projeto</h3>
                
                <div className="viewer-field">
                  <label>Nome</label>
                  <p>{project.name}</p>
                </div>

                {project.description && (
                  <div className="viewer-field">
                    <label>Descrição</label>
                    <p>{project.description}</p>
                  </div>
                )}

                <div className="viewer-field">
                  <label>Modo de Exibição</label>
                  <p>{project.displayMode === 'LIST' ? 'Lista' : 'Blocos'}</p>
                </div>

                <div className="viewer-field">
                  <label>Cor</label>
                  <div className="color-display">
                    <span 
                      className="color-preview"
                      style={{ backgroundColor: project.color || '#4adeb9' }}
                    />
                    <span>{project.color || '#4adeb9'}</span>
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Membros do Projeto</h3>
                <div className="members-list">
                  <div className="member-item admin">
                    <div className="member-info">
                      <span className="member-email">{project.adminEmail || 'Administrador'}</span>
                      <span className="member-role">ADM</span>
                    </div>
                  </div>

                  {(project.members || []).map((member, index) => (
                    <div key={index} className="member-item">
                      <div className="member-info">
                        <span className="member-email">{member.email}</span>
                        <span className="member-role">Convidado</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {showDeleteConfirm && isAdmin && (
          <div className="delete-confirmation">
            <div className="confirmation-content">
              <h4>Apagar Projeto</h4>
              <p>
                Esta ação é <strong>irreversível</strong>. O projeto "<strong>{project.name}</strong>" e todas as suas tarefas serão deletados permanentemente.
              </p>
              <p>Tem certeza que deseja continuar?</p>
              <div className="confirmation-actions">
                <button
                  className="btn-confirm-delete"
                  onClick={handleDelete}
                >
                  Sim, Apagar Tudo
                </button>
                <button
                  className="btn-cancel-delete"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectSettingsModal;
