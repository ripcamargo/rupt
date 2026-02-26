import { formatDuration } from './timeFormatter';

/**
 * Format date for log display
 */
function formatDateForLog(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format time for log display
 */
function formatTimeForLog(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate log text for tasks
 */
export function generateLogText(tasks, date = null) {
  const lines = [];
  
  // Header
  lines.push('='.repeat(60));
  lines.push('RUPT - LOG DE ATIVIDADES');
  lines.push('='.repeat(60));
  lines.push('');
  
  if (date) {
    lines.push(`Data: ${formatDateForLog(date)}`);
  } else {
    lines.push('LOG COMPLETO');
  }
  
  lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');

  // Group tasks by date
  const tasksByDate = {};
  tasks.forEach(task => {
    const taskDate = new Date(task.createdAt).toLocaleDateString('pt-BR');
    if (!tasksByDate[taskDate]) {
      tasksByDate[taskDate] = [];
    }
    tasksByDate[taskDate].push(task);
  });

  // Sort dates descending
  const sortedDates = Object.keys(tasksByDate).sort((a, b) => {
    const dateA = a.split('/').reverse().join('');
    const dateB = b.split('/').reverse().join('');
    return dateB.localeCompare(dateA);
  });

  // Generate log for each date
  sortedDates.forEach(dateKey => {
    const dateTasks = tasksByDate[dateKey];
    const dayTotal = dateTasks.reduce((sum, t) => sum + t.totalDurationSeconds, 0);

    lines.push(`DATA: ${dateKey}`);
    lines.push(`Total do dia: ${formatDuration(dayTotal)}`);
    lines.push('-'.repeat(60));
    lines.push('');

    // Sort tasks by creation time
    const sortedTasks = [...dateTasks].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    sortedTasks.forEach((task, index) => {
      lines.push(`${index + 1}. ${task.description}`);
      if (task.requester) {
        lines.push(`   Solicitante: ${task.requester}`);
      }
      lines.push(`   Horário: ${formatTimeForLog(task.startedAt)}`);
      lines.push(`   Duração: ${formatDuration(task.totalDurationSeconds)}`);
      lines.push(`   Status: ${task.status === 'completed' ? 'Concluído' : task.status === 'running' ? 'Em andamento' : 'Pausado'}`);
      if (task.isUrgent) {
        lines.push(`   🚨 URGENTE`);
      }
      if (task.manuallyEdited) {
        lines.push(`   ⚠️ Contador editado manualmente`);
      }
      lines.push('');
    });

    lines.push('');
  });

  lines.push('='.repeat(60));
  lines.push('FIM DO LOG');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Download log as text file
 */
export function downloadLog(tasks, date = null) {
  const logText = generateLogText(tasks, date);
  const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const filename = date
    ? `rupt-log-${formatDateForLog(date).replace(/\//g, '-')}.txt`
    : `rupt-log-completo.txt`;
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export tasks as JSON file for import/backup
 */
export function exportTasksAsJSON(tasks) {
  const data = JSON.stringify(tasks, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const filename = `rupt-tarefas-${new Date().toISOString().split('T')[0]}.json`;
  
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import tasks from JSON file
 */
export function importTasksFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        const tasks = JSON.parse(content);
        
        if (!Array.isArray(tasks)) {
          reject(new Error('O arquivo não contém um array de tarefas válido'));
          return;
        }
        
        // Validate task structure
        const validTasks = tasks.filter(task => {
          return task.id && task.description && task.totalDurationSeconds !== undefined;
        });
        
        if (validTasks.length === 0) {
          reject(new Error('Nenhuma tarefa válida encontrada no arquivo'));
          return;
        }
        
        resolve(validTasks);
      } catch (error) {
        reject(new Error('Erro ao ler o arquivo JSON: ' + error.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler o arquivo'));
    };
    
    reader.readAsText(file);
  });
}
