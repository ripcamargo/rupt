import { useState, useRef } from 'react';
import { downloadLog, exportTasksAsJSON, importTasksFromJSON } from '../utils/logExporter';
import { CloseIcon } from './Icons';
import '../styles/ExportImportModal.css';

function ExportImportModal({ isOpen, onClose, allTasks, onImport }) {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('export');
  const [exportType, setExportType] = useState('txt');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  if (!isOpen) return null;

  // Get unique dates from tasks
  const uniqueDates = [...new Set(allTasks.map(t => new Date(t.createdAt).toISOString().split('T')[0]))].sort().reverse();

  const handleExport = () => {
    setImportError('');
    setImportSuccess('');

    if (exportType === 'txt') {
      if (dateFilter === 'all') {
        downloadLog(allTasks);
      } else if (dateFilter === 'specific' && selectedDate) {
        // Filter tasks by selected date
        const selectedDateObj = new Date(selectedDate);
        const filteredTasks = allTasks.filter(task => {
          const taskDate = new Date(task.createdAt);
          return taskDate.toDateString() === selectedDateObj.toDateString();
        });

        if (filteredTasks.length === 0) {
          setImportError('Nenhuma tarefa encontrada nesta data.');
          return;
        }

        downloadLog(filteredTasks, selectedDate);
      }
    } else if (exportType === 'json') {
      if (dateFilter === 'all') {
        exportTasksAsJSON(allTasks);
      } else if (dateFilter === 'specific' && selectedDate) {
        const selectedDateObj = new Date(selectedDate);
        const filteredTasks = allTasks.filter(task => {
          const taskDate = new Date(task.createdAt);
          return taskDate.toDateString() === selectedDateObj.toDateString();
        });

        if (filteredTasks.length === 0) {
          setImportError('Nenhuma tarefa encontrada nesta data.');
          return;
        }

        exportTasksAsJSON(filteredTasks);
      }
    }
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
      
      // Check for duplicate IDs
      const existingIds = new Set(allTasks.map(t => t.id));
      const newTasks = tasks.filter(t => !existingIds.has(t.id));
      
      const totalNewTasks = newTasks.length;
      const totalDuplicated = tasks.length - totalNewTasks;
      
      if (totalNewTasks === 0) {
        setImportError('Nenhuma tarefa nova para importar. Todas as tarefas já existem.');
      } else {
        onImport(newTasks);
        setImportSuccess(
          `✅ ${totalNewTasks} tarefa${totalNewTasks > 1 ? 's' : ''} importada${totalNewTasks > 1 ? 's' : ''} com sucesso!${
            totalDuplicated > 0 ? ` (${totalDuplicated} duplicada${totalDuplicated > 1 ? 's' : ''} ignorada${totalDuplicated > 1 ? 's' : ''})` : ''
          }`
        );
      }
      
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

  return (
    <div className="export-import-overlay" onClick={onClose}>
      <div className="export-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-import-header">
          <h2>Exportar/Importar Log de Tarefas</h2>
          <button className="close-btn" onClick={onClose}>
            <CloseIcon size={24} />
          </button>
        </div>

        <div className="export-import-tabs">
          <button
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            📥 Exportar
          </button>
          <button
            className={`tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📤 Importar
          </button>
        </div>

        <div className="export-import-content">
          {activeTab === 'export' && (
            <div className="export-section">
              <div className="form-group">
                <label>Tipo de Arquivo:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="txt"
                      checked={exportType === 'txt'}
                      onChange={(e) => setExportType(e.target.value)}
                    />
                    <span>TXT (Legível)</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="json"
                      checked={exportType === 'json'}
                      onChange={(e) => setExportType(e.target.value)}
                    />
                    <span>JSON (Para importar)</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Período:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="all"
                      checked={dateFilter === 'all'}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                    <span>Todas as datas</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="specific"
                      checked={dateFilter === 'specific'}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                    <span>Data específica</span>
                  </label>
                </div>
              </div>

              {dateFilter === 'specific' && (
                <div className="form-group">
                  <label htmlFor="date-select">Selecione a data:</label>
                  <select
                    id="date-select"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="date-select"
                  >
                    <option value="">-- Selecione uma data --</option>
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>
                        {new Date(date).toLocaleDateString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="btn-export-modal"
                onClick={handleExport}
                disabled={dateFilter === 'specific' && !selectedDate}
              >
                ⬇️ Exportar
              </button>

              {importError && <p className="error-msg">{importError}</p>}
              {importSuccess && <p className="success-msg">{importSuccess}</p>}
            </div>
          )}

          {activeTab === 'import' && (
            <div className="import-section">
              <div className="import-info">
                <p>Selecione um arquivo JSON exportado anteriormente para importar suas tarefas.</p>
                <p>As tarefas duplicadas serão ignoradas automaticamente.</p>
              </div>

              <button className="btn-import-modal" onClick={handleImportClick}>
                📂 Selecionar Arquivo JSON
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelected}
                style={{ display: 'none' }}
              />

              {importError && <p className="error-msg">{importError}</p>}
              {importSuccess && <p className="success-msg">{importSuccess}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportImportModal;
