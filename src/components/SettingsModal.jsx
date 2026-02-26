import { useState, useRef } from 'react';
import { CloseIcon, InfoIcon } from './Icons';
import ExportImportModal from './ExportImportModal';
import '../styles/SettingsModal.css';

function SettingsModal({ isOpen, onClose, settings, onSave, allTasks, isLoggedIn }) {
  const [isExportImportModalOpen, setIsExportImportModalOpen] = useState(false);
  
  const [roundingMode, setRoundingMode] = useState(settings.roundingMode);
  const [roundingStep, setRoundingStep] = useState(settings.roundingStep);
  const [notificationEnabled, setNotificationEnabled] = useState(settings.notificationEnabled);
  const [notificationInterval, setNotificationInterval] = useState(settings.notificationInterval);
  const [notifyCommonTasks, setNotifyCommonTasks] = useState(settings.notifyCommonTasks);
  const [notifyUrgentTasks, setNotifyUrgentTasks] = useState(settings.notifyUrgentTasks);
  const [soundCommonTasks, setSoundCommonTasks] = useState(settings.soundCommonTasks);
  const [soundUrgentTasks, setSoundUrgentTasks] = useState(settings.soundUrgentTasks);
  const [entryTime, setEntryTime] = useState(settings.entryTime);
  const [lunchTime, setLunchTime] = useState(settings.lunchTime);
  const [exitTime, setExitTime] = useState(settings.exitTime);
  const [workHoursNotification, setWorkHoursNotification] = useState(settings.workHoursNotification);
  const [requireDetails, setRequireDetails] = useState(settings.requireDetails);
  const [requireRequester, setRequireRequester] = useState(settings.requireRequester);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      roundingMode,
      roundingStep,
      notificationEnabled,
      notificationInterval,
      notifyCommonTasks,
      notifyUrgentTasks,
      soundCommonTasks,
      soundUrgentTasks,
      entryTime,
      lunchTime,
      exitTime,
      workHoursNotification,
      requireDetails,
      requireRequester,
    });
    onClose();
  };

  const handleDownloadFullLog = () => {
    downloadLog(allTasks);
  };

  const handleExportJSON = () => {
    setImportError('');
    setImportSuccess('');
    exportTasksAsJSON(allTasks);
  };

  const handleImportClick = () => {
    setImportError('');
    setImportSuccess('');
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tasks = await importTasksFromJSON(file);
      
      // Check for duplicate IDs and merge
      const existingIds = new Set(allTasks.map(t => t.id));
      const newTasks = tasks.filter(t => !existingIds.has(t.id));
      
      const totalNewTasks = newTasks.length;
      const totalDuplicated = tasks.length - totalNewTasks;
      
      if (totalNewTasks === 0) {
        setImportError('Nenhuma tarefa nova para importar. Todas as tarefas já existem.');
      } else {
        // Callback to parent to add tasks
        onSave({
          roundingMode,
          roundingStep,
          notificationEnabled,
          notificationInterval,
          notifyCommonTasks,
          notifyUrgentTasks,
          soundCommonTasks,
          soundUrgentTasks,
          entryTime,
          lunchTime,
          exitTime,
          workHoursNotification,
          requireDetails,
          requireRequester,
        }, newTasks);
        
        setImportSuccess(
          `✅ ${totalNewTasks} tarefa${totalNewTasks > 1 ? 's' : ''} importada${totalNewTasks > 1 ? 's' : ''} com sucesso!${
            totalDuplicated > 0 ? ` (${totalDuplicated} duplicada${totalDuplicated > 1 ? 's' : ''} ignorada${totalDuplicated > 1 ? 's' : ''})` : ''
          }`
        );
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setImportError(`❌ ${err.message}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportFromModal = (newTasks) => {
    onSave({
      roundingMode,
      roundingStep,
      notificationEnabled,
      notificationInterval,
      notifyCommonTasks,
      notifyUrgentTasks,
      soundCommonTasks,
      soundUrgentTasks,
      entryTime,
      lunchTime,
      exitTime,
      workHoursNotification,
      requireDetails,
      requireRequester,
    }, newTasks);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configurações</h2>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>Notificações</h3>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={notificationEnabled}
                onChange={(e) => setNotificationEnabled(e.target.checked)}
              />
              <span>Ativar notificações de tarefas</span>
            </label>

            {notificationEnabled && (
              <>
                <div className="checkbox-inline-group">
                  <span className="checkbox-inline-label">Ativar notificação de tarefas:</span>
                  <label className="checkbox-inline-option">
                    <input
                      type="checkbox"
                      checked={notifyCommonTasks}
                      onChange={(e) => setNotifyCommonTasks(e.target.checked)}
                    />
                    <span>Comuns</span>
                  </label>
                  <label className="checkbox-inline-option">
                    <input
                      type="checkbox"
                      checked={notifyUrgentTasks}
                      onChange={(e) => setNotifyUrgentTasks(e.target.checked)}
                    />
                    <span>Urgentes</span>
                  </label>
                </div>

                <div className="checkbox-inline-group">
                  <span className="checkbox-inline-label">Ativar som de tarefas:</span>
                  <label className="checkbox-inline-option">
                    <input
                      type="checkbox"
                      checked={soundCommonTasks}
                      onChange={(e) => setSoundCommonTasks(e.target.checked)}
                    />
                    <span>Comuns</span>
                  </label>
                  <label className="checkbox-inline-option">
                    <input
                      type="checkbox"
                      checked={soundUrgentTasks}
                      onChange={(e) => setSoundUrgentTasks(e.target.checked)}
                    />
                    <span>Urgentes</span>
                  </label>
                </div>

                <div className="step-setting">
                  <label htmlFor="notification-interval">Intervalo de notificação (minutos):</label>
                  <input
                    id="notification-interval"
                    type="number"
                    min="1"
                    max="120"
                    value={notificationInterval}
                    onChange={(e) => setNotificationInterval(parseInt(e.target.value) || 60)}
                    className="step-input"
                  />
                </div>
              </>
            )}
          </div>

          <div className="settings-section">
            <h3>Campos Obrigatórios</h3>
            
            <label className="checkbox-option disabled">
              <input
                type="checkbox"
                checked={true}
                disabled={true}
              />
              <span>Assunto (sempre obrigatório)</span>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={requireDetails}
                onChange={(e) => setRequireDetails(e.target.checked)}
              />
              <span>Descrição</span>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={requireRequester}
                onChange={(e) => setRequireRequester(e.target.checked)}
              />
              <span>Solicitante</span>
            </label>
          </div>

          <div className="settings-section">
            <h3>Arredondar Períodos</h3>
            
            <div className="sentence-setting">
              <span className="sentence-text">Ao concluir uma tarefa,</span>
              <select
                className="sentence-select"
                value={roundingMode}
                onChange={(e) => setRoundingMode(e.target.value)}
              >
                <option value="none">Não Arredondar</option>
                <option value="up">Arredondar para cima</option>
                <option value="down">Arredondar para baixo</option>
              </select>
              <span className="sentence-text">o tempo contabilizado</span>
              {(roundingMode === 'up' || roundingMode === 'down') && (
                <>
                  <span className="sentence-text">em</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={roundingStep}
                    onChange={(e) => setRoundingStep(parseInt(e.target.value) || 5)}
                    className="sentence-input"
                  />
                  <span className="sentence-text">minuto(s).</span>
                </>
              )}
              <span className="sentence-text"></span>
            </div>
          </div>

          <div className="settings-section">
            <h3>Horário de Trabalho</h3>
            
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={workHoursNotification}
                onChange={(e) => setWorkHoursNotification(e.target.checked)}
              />
              <span>Notificar 5 minutos antes do almoço e saída</span>
            </label>

            {workHoursNotification && (
              <div className="time-settings">
                <div className="time-setting">
                  <label htmlFor="entry-time">Entrada:</label>
                  <input
                    id="entry-time"
                    type="time"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                    className="time-input"
                  />
                </div>

                <div className="time-setting">
                  <label htmlFor="lunch-time">Almoço:</label>
                  <input
                    id="lunch-time"
                    type="time"
                    value={lunchTime}
                    onChange={(e) => setLunchTime(e.target.value)}
                    className="time-input"
                  />
                </div>

                <div className="time-setting">
                  <label htmlFor="exit-time">Saída:</label>
                  <input
                    id="exit-time"
                    type="time"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="time-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Exportar e Importar Dados</h3>
            <button 
              className="btn-export-import-main"
              onClick={() => setIsExportImportModalOpen(true)}
            >
              📊 Exportar/Importar Log de Tarefas
            </button>
          </div>

          {!isLoggedIn && (
            <div className="settings-section info-section">
              <div className="storage-info">
                <span className="info-icon"><InfoIcon size={20} /></span>
                <div className="info-text">
                  <strong>Armazenamento de Dados</strong>
                  <p>
                    Seus registros ficam salvos localmente no navegador (cache/localStorage). 
                    Caso você limpe o cache do navegador, todas as informações serão perdidas. 
                    Recomendamos exportar seus dados periodicamente para não perdê-los.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>

      <ExportImportModal
        isOpen={isExportImportModalOpen}
        onClose={() => setIsExportImportModalOpen(false)}
        allTasks={allTasks}
        onImport={handleImportFromModal}
      />
    </div>
  );
}

export default SettingsModal;
