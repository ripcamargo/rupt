import '../styles/AuthGate.css';

function AuthGate({ isOpen, onUseWithoutLogin, onSignUp }) {
  if (!isOpen) return null;

  return (
    <div className="auth-gate-overlay">
      <div className="auth-gate-card">
        <div className="auth-gate-header">
          <span className="auth-gate-kicker">RUPT! TIMELOG</span>
          <h2 className="auth-gate-title">Bem-vindo ao Rupt!</h2>
          <p className="auth-gate-lead">
            O Rupt! nasceu para te auxiliar a registrar o tempo de suas atividades de forma rapida e pratica.
          </p>
        </div>

        <ul className="auth-gate-list">
          <li>
            <span className="auth-gate-list-title">Registro Rápido</span>
            <span className="auth-gate-list-text">Crie tarefas em segundos e comece a contar o tempo.</span>
          </li>
          <li>
            <span className="auth-gate-list-title">Cronômetro Inteligente</span>
            <span className="auth-gate-list-text">Acompanhe o tempo automaticamente enquanto trabalha.</span>
          </li>
          <li>
            <span className="auth-gate-list-title">Organização de Tarefas</span>
            <span className="auth-gate-list-text">Organize suas tarefas em andamento e tenha acesso 
                ao histórico de tudo o que foi feito nos dias anteriores.</span>
          </li>
        </ul>

        <div className="auth-gate-header auth-gate-header-center">
          <p className="auth-gate-lead">
            Bora organizar os seus dias caóticos?
          </p>
        </div>

        <div className="auth-gate-actions">
          <button className="auth-gate-secondary" onClick={onUseWithoutLogin}>
            Usar sem cadastro
          </button>
          <button className="auth-gate-primary" onClick={onSignUp}>
            Entrar / Cadastrar
          </button>
        </div>
        <p className="auth-gate-note">
          Você não precisa se cadastrar para usar, mas ao criar sua conta seus dados ficam salvos e disponíveis em qualquer dispositivo. 
        </p>
      </div>
    </div>
  );
}

export default AuthGate;
