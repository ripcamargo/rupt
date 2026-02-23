import { useState } from 'react';
import { downloadLog } from '../utils/logExporter';
import '../styles/SettingsModal.css';

function SettingsModal({ isOpen, onClose, settings, onSave, allTasks }) {
  const [roundingMode, setRoundingMode] = useState(settings.roundingMode);
  const [roundingStep, setRoundingStep] = useState(settings.roundingStep);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      roundingMode,
      roundingStep,
    });
    onClose();
  };

  const handleDownloadFullLog = () => {
    downloadLog(allTasks);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configurações</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>Arredondar Períodos</h3>
            
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="rounding"
                  value="up"
                  checked={roundingMode === 'up'}
                  onChange={(e) => setRoundingMode(e.target.value)}
                />
                <span>Para Cima</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="rounding"
                  value="down"
                  checked={roundingMode === 'down'}
                  onChange={(e) => setRoundingMode(e.target.value)}
                />
                <span>Para Baixo</span>
              </label>

              <label className="radio-option">
                <input
                  type="radio"
                  name="rounding"
                  value="none"
                  checked={roundingMode === 'none'}
                  onChange={(e) => setRoundingMode(e.target.value)}
                />
                <span>Não Arredondar</span>
              </label>
            </div>

            {(roundingMode === 'up' || roundingMode === 'down') && (
              <div className="step-setting">
                <label htmlFor="step">Passo do arredondamento (minutos):</label>
                <input
                  id="step"
                  type="number"
                  min="1"
                  max="60"
                  value={roundingStep}
                  onChange={(e) => setRoundingStep(parseInt(e.target.value) || 10)}
                  className="step-input"
                />
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>Exportar Dados</h3>
            <button className="btn-export" onClick={handleDownloadFullLog}>
              📥 Baixar Log Completo de Atividades
            </button>
          </div>
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
    </div>
  );
}

export default SettingsModal;
