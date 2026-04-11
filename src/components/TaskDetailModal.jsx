import { useState, useEffect, useRef } from 'react';
import { formatDurationForEdit, parseTimeToSeconds, formatDuration } from '../utils/timeFormatter';
import { uploadTaskAttachment, deleteTaskAttachment } from '../utils/storageUpload';
import '../styles/TaskDetailModal.css';

function TaskDetailModal({ task, isRunning, elapsedSeconds, onClose, onUpdateTask, onEditTime, onDelete, currentProject, currentUserEmail, currentUserDisplayName, isDefaultProject }) {
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [requester, setRequester] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [editingTime, setEditingTime] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [links, setLinks] = useState([]);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!task) return;
    setDescription(task.description || '');
    setDetails(task.details || '');
    setRequester(task.requester || '');
    setTimeValue(formatDurationForEdit(task.totalDurationSeconds || 0));
    setEditingTime(false);
    setShowDeleteConfirm(false);
    setAttachments(task.attachments || []);
    setLinks(task.links || []);
    setNewLinkUrl('');
    setUploadError('');
  }, [task]);

  if (!task) return null;

  const totalSeconds = task.totalDurationSeconds + (isRunning ? elapsedSeconds : 0);

  const handleSave = () => {
    if (description.trim() !== task.description) {
      onUpdateTask(task.id, 'description', description.trim());
    }
    if (details.trim() !== (task.details || '')) {
      onUpdateTask(task.id, 'details', details.trim());
    }
    if (requester.trim() !== (task.requester || '')) {
      onUpdateTask(task.id, 'requester', requester.trim());
    }
    onClose();
  };

  const handleTimeSave = () => {
    const newSeconds = parseTimeToSeconds(timeValue);
    if (newSeconds !== task.totalDurationSeconds) {
      onEditTime(task.id, newSeconds);
    }
    setEditingTime(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const attachment = await uploadTaskAttachment(task.id, file, setUploadProgress);
      const newAttachments = [...attachments, attachment];
      setAttachments(newAttachments);
      onUpdateTask(task.id, 'attachments', newAttachments);
    } catch (err) {
      setUploadError(err.message || 'Erro ao fazer upload.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAddLink = () => {
    const raw = newLinkUrl.trim();
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const newLinks = [...links, { url }];
    setLinks(newLinks);
    onUpdateTask(task.id, 'links', newLinks);
    setNewLinkUrl('');
  };

  const handleDeleteLink = (index) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
    onUpdateTask(task.id, 'links', newLinks);
  };

  const handleDeleteAttachment = async (index) => {
    const att = attachments[index];
    const newAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(newAttachments);
    onUpdateTask(task.id, 'attachments', newAttachments);
    if (att.path) await deleteTaskAttachment(att.path);
  };

  const isImage = (type) => type?.startsWith('image/');

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const createdAt = task.createdAt
    ? new Date(task.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
    <div className="task-detail-overlay" onClick={onClose}>
      <div className="task-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="task-detail-header">
          <span className={`task-detail-status-dot status-${task.status}`} title={task.status} />
          <button className="task-detail-close" onClick={onClose} title="Fechar">✕</button>
        </div>

        <div className="task-detail-body">
          {/* Título */}
          <div className="task-detail-field">
            <label>Assunto</label>
            <input
              className="task-detail-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Assunto da tarefa"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div className="task-detail-field">
            <label>Descrição</label>
            <textarea
              className="task-detail-textarea"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descrição / detalhes"
              rows={3}
            />
          </div>

          {/* Solicitante */}
          <div className="task-detail-field">
            <label>Solicitante</label>
            <input
              className="task-detail-input"
              value={requester}
              onChange={(e) => setRequester(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Solicitante"
            />
          </div>

          {/* Responsável (só em projetos compartilhados) */}
          {!isDefaultProject && (() => {
            const seen = new Set();
            const participants = [];
            if (currentProject?.adminEmail) {
              seen.add(currentProject.adminEmail.toLowerCase());
              const isMe = currentProject.adminEmail.toLowerCase() === currentUserEmail?.toLowerCase();
              const adminMember = currentProject.members?.find(m => m.email?.toLowerCase() === currentProject.adminEmail.toLowerCase());
              const name = isMe
                ? (currentUserDisplayName || adminMember?.name || currentProject.adminEmail.split('@')[0])
                : (currentProject.adminName || adminMember?.name || currentProject.adminEmail.split('@')[0]);
              participants.push({ email: currentProject.adminEmail, name });
            }
            (currentProject?.members || []).forEach(m => {
              if (m.email && !seen.has(m.email.toLowerCase())) {
                seen.add(m.email.toLowerCase());
                const isMe = m.email.toLowerCase() === currentUserEmail?.toLowerCase();
                const name = isMe
                  ? (currentUserDisplayName || m.name || m.email.split('@')[0])
                  : (m.name || m.email.split('@')[0]);
                participants.push({ email: m.email, name });
              }
            });
            if (participants.length === 0) return null;
            return (
              <div className="task-detail-field">
                <label>Responsável</label>
                <select
                  className="task-detail-select"
                  value={task.assignedTo || currentUserEmail}
                  onChange={(e) => onUpdateTask(task.id, 'assignedTo', e.target.value)}
                >
                  {participants.map((p) => (
                    <option key={p.email} value={p.email}>{p.name}</option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Tempo */}
          <div className="task-detail-field">
            <label>Tempo registrado</label>
            <div className="task-detail-time-row">
              {editingTime ? (
                <>
                  <input
                    className="task-detail-input time-edit"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleTimeSave(); if (e.key === 'Escape') setEditingTime(false); }}
                    placeholder="HH:mm:ss"
                    autoFocus
                  />
                  <button className="task-detail-btn-secondary" onClick={handleTimeSave}>OK</button>
                  <button className="task-detail-btn-ghost" onClick={() => setEditingTime(false)}>Cancelar</button>
                </>
              ) : (
                <>
                  <span className="task-detail-time-value">{formatDuration(totalSeconds)}</span>
                  <button className="task-detail-btn-ghost" onClick={() => { setTimeValue(formatDurationForEdit(task.totalDurationSeconds)); setEditingTime(true); }}>Editar</button>
                </>
              )}
            </div>
          </div>

          {/* Criado em */}
          {createdAt && (
            <div className="task-detail-meta">
              Criado em {createdAt}
            </div>
          )}

          {/* Anexos */}
          <div className="task-detail-field">
            <label>Anexos</label>

            {attachments.length > 0 && (
              <div className="task-detail-attachments">
                {attachments.map((att, i) => (
                  <div key={i} className="task-attachment-item">
                    {isImage(att.type) ? (
                      <img
                        src={att.url}
                        alt={att.name}
                        className="task-attachment-thumb"
                        onClick={() => setLightboxUrl(att.url)}
                        title="Clique para ampliar"
                      />
                    ) : (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="task-attachment-file"
                        title={att.name}
                        download={att.name}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="task-attachment-file-icon">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="task-attachment-ext">{att.name.split('.').pop().toUpperCase()}</span>
                      </a>
                    )}
                    <div className="task-attachment-info">
                      {isImage(att.type) && (
                        <span className="task-attachment-name-small">{att.name}</span>
                      )}
                      {att.size && <span className="task-attachment-size">{formatBytes(att.size)}</span>}
                    </div>
                    <button
                      className="task-attachment-delete"
                      onClick={() => handleDeleteAttachment(i)}
                      title="Remover anexo"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {uploading ? (
              <div className="task-attachment-progress">
                <div className="task-attachment-progress-bar" style={{ width: `${uploadProgress}%` }} />
                <span>{uploadProgress}%</span>
              </div>
            ) : (
              <>
                <button
                  className="task-detail-btn-ghost task-attachment-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  + Adicionar anexo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </>
            )}
            {uploadError && <span className="task-attachment-error">{uploadError}</span>}
          </div>

          {/* Links externos */}
          <div className="task-detail-field">
            <label>Links</label>
            {links.length > 0 && (
              <ul className="task-links-list">
                {links.map((link, i) => (
                  <li key={i} className="task-link-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="task-link-icon">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <a href={link.url} target="_blank" rel="noreferrer" className="task-link-url" title={link.url}>
                      {link.url.replace(/^https?:\/\//i, '')}
                    </a>
                    <button className="task-link-delete" onClick={() => handleDeleteLink(i)} title="Remover link">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="task-link-add-row">
              <input
                className="task-detail-input"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddLink(); }}
                placeholder="https://..."
              />
              <button className="task-detail-btn-ghost" onClick={handleAddLink}>Adicionar</button>
            </div>
          </div>
        </div>

        <div className="task-detail-footer">
          {showDeleteConfirm ? (
            <div className="task-detail-delete-confirm">
              <span>Excluir esta tarefa?</span>
              <button className="task-detail-btn-danger" onClick={() => { onDelete(task.id); onClose(); }}>Sim, excluir</button>
              <button className="task-detail-btn-ghost" onClick={() => setShowDeleteConfirm(false)}>Cancelar</button>
            </div>
          ) : (
            <>
              <button className="task-detail-btn-ghost task-detail-btn-delete" onClick={() => setShowDeleteConfirm(true)}>Excluir</button>
              <button className="task-detail-btn-primary" onClick={handleSave}>Salvar</button>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Lightbox */}
    {lightboxUrl && (
      <div className="task-lightbox" onClick={() => setLightboxUrl(null)}>
        <img src={lightboxUrl} alt="Anexo ampliado" className="task-lightbox-img" />
        <button className="task-lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
      </div>
    )}
  </>
  );
}

export default TaskDetailModal;
