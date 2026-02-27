import { useState, useEffect } from 'react';
import { CloseIcon, SettingsIcon } from './Icons';
import '../styles/ProjectSettingsModal.css';

function ProjectSettingsModal({ isOpen, onClose, project, currentUserId, user, onOpenAuth, onUpdate, onDelete, onLeaveProject }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    displayMode: 'LIST',
    color: '#4adeb9',
    groupByDay: true,
  });
  const [members, setMembers] = useState([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  useEffect(() => {
    if (project && isOpen) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        displayMode: project.displayMode || 'LIST',
        color: project.color || '#4adeb9',
        groupByDay: project.groupByDay !== undefined ? project.groupByDay : true,
      });
      setMembers(project.members || []);
      setNewMemberEmail('');
    }
  }, [project, isOpen]);

  const isAdmin = currentUserId === project?.adminId;
  const isDefaultProject = project?.id === 'default';
  const isMember = user && project?.members?.some(m => m.email === user.email);
  const canEdit = isAdmin || isDefaultProject;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
    if (!canEdit) return;

    if (isDefaultProject) {
      onUpdate({
        ...project,
        displayMode: formData.displayMode,
        color: formData.color,
        groupByDay: formData.groupByDay,
      });
      onClose();
      return;
    }

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

  const handleLeaveProject = () => {
    onLeaveProject(project.id);
    onClose();
  };

  if (!isOpen || !project) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal project-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <h2>Configurações do Projeto</h2>
            {!canEdit && <span className="badge-viewer">Apenas visualização</span>}
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        {canEdit ? (
          <form onSubmit={handleSave} className="project-settings-form">
              {/* Basic Info */}
              {!isDefaultProject && (
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
                      disabled={!isAdmin || isDefaultProject}
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
                      disabled={!isAdmin || isDefaultProject}
                    />
                  </div>
                </div>
              )}

              {/* Display Settings */}
              <div className="form-section">
                <h3>Visualização</h3>
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="project-mode">Modo de Exibição</label>
                    <select
                      id="project-mode"
                      name="displayMode"
                      value={formData.displayMode}
                      onChange={handleChange}
                      className="form-select"
                      disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                      <span className="color-value">{formData.color}</span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="groupByDay"
                      checked={formData.groupByDay}
                      onChange={handleChange}
                      disabled={!canEdit}
                    />
                      Agrupar tarefas por dia
                  </label>
                </div>
              </div>

              {/* Members */}
              {!isDefaultProject && (
                <div className="form-section">
                  <h3>Membros do Projeto</h3>
                  
                  {!user ? (
                    <div className="form-group login-prompt">
                      <p className="login-message">Você precisa estar logado para adicionar membros ao seu projeto</p>
                      <button
                        type="button"
                        className="btn-login-prompt"
                        onClick={onOpenAuth}
                      >
                        Entrar / Cadastrar
                      </button>
                    </div>
                  ) : (
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
                  )}

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
                </div>
              )}

              {/* Action Buttons */}
              <div className="form-section form-actions">
                <button type="submit" className="btn-save-settings">
                  Salvar Alterações
                </button>
                {!isDefaultProject && (
                  <button
                    type="button"
                    className="btn-delete-project"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Apagar Projeto
                  </button>
                )}
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

              {/* Leave Project Button for Members */}
              {!isAdmin && isMember && !isDefaultProject && (
                <div className="form-section form-actions">
                  <button
                    type="button"
                    className="btn-leave-project"
                    onClick={() => setShowLeaveConfirm(true)}
                  >
                    Sair do Projeto
                  </button>
                </div>
              )}
            </div>
        )}

        {showLeaveConfirm && isMember && !isAdmin && (
          <div className="delete-confirmation">
            <div className="confirmation-content">
              <h4>Sair do Projeto</h4>
              <p>
                Você tem certeza que deseja sair do projeto "<strong>{project.name}</strong>"?
              </p>
              <p>
                Você perderá acesso a todas as tarefas e informações deste projeto.
                Se precisar acessá-lo novamente, será necessário um novo convite do administrador.
              </p>
              <div className="confirmation-actions">
                <button
                  className="btn-confirm-leave"
                  onClick={handleLeaveProject}
                >
                  Sim, Sair do Projeto
                </button>
                <button
                  className="btn-cancel-delete"
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

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
