import { useRef, useState } from 'react';

const CHANNEL_NAME = 'rupt-pip-channel';

// Styles injected into the PiP window
const PIP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d0d0d;
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
  }
  .pip-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .pip-logo {
    font-size: 13px;
    font-weight: 700;
    color: #4adeb9;
    letter-spacing: 0.5px;
  }
  .pip-project {
    font-size: 11px;
    color: #555;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }
  .pip-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  .pip-input {
    flex: 1;
    padding: 10px 12px;
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    border-radius: 8px;
    color: #f0f0f0;
    font-size: 14px;
    outline: none;
    resize: none;
    transition: border-color 0.15s;
  }
  .pip-input:focus {
    border-color: #4adeb9;
  }
  .pip-input::placeholder { color: #444; }
  .pip-btn {
    padding: 9px;
    background: #4adeb9;
    color: #04110c;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }
  .pip-btn:hover { background: #5be896; }
  .pip-hint {
    font-size: 10px;
    color: #333;
    text-align: center;
    margin-top: 2px;
  }
`;

function openPip(projectName, onClose) {
  if (!window.documentPictureInPicture) {
    alert('Seu navegador não suporta o modo Mini (Document Picture-in-Picture).\nUse Chrome 116+ ou Edge 116+.');
    return;
  }

  window.documentPictureInPicture
    .requestWindow({ width: 300, height: 180 })
    .then((pipWin) => {
      // Inject styles
      const style = pipWin.document.createElement('style');
      style.textContent = PIP_STYLES;
      pipWin.document.head.appendChild(style);

      // Build HTML
      pipWin.document.body.innerHTML = `
        <div class="pip-header">
          <span class="pip-logo">rupt!</span>
          <span class="pip-project">${projectName || 'Minhas Tarefas'}</span>
        </div>
        <form class="pip-form" id="pip-form">
          <input
            id="pip-input"
            class="pip-input"
            placeholder="Nova tarefa... (Enter para criar)"
            autocomplete="off"
            autofocus
          />
          <button type="submit" class="pip-btn">+ Criar Tarefa</button>
          <span class="pip-hint">Enter para criar • Esc para fechar</span>
        </form>
      `;

      const input = pipWin.document.getElementById('pip-input');
      const form = pipWin.document.getElementById('pip-form');
      const channel = new BroadcastChannel(CHANNEL_NAME);

      input.focus();

      const submit = (e) => {
        e && e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        channel.postMessage({ type: 'CREATE_TASK', description: text });
        input.value = '';
        input.focus();
      };

      form.addEventListener('submit', submit);

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') pipWin.close();
      });

      pipWin.addEventListener('pagehide', () => {
        channel.close();
        onClose?.();
      });
    })
    .catch(() => {}); // user dismissed
}

export { openPip, CHANNEL_NAME };
