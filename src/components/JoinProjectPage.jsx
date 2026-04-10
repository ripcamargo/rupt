import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { loadSharedProject, joinProjectViaInvite, saveUserData } from '../utils/firestore';
import '../styles/JoinProjectPage.css';

function JoinProjectPage({ onOpenAuth }) {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [pageState, setPageState] = useState('loading'); // loading | invalid | already_member | ready | joining | joined | error
  const [errorMsg, setErrorMsg] = useState('');

  // Listen for auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return unsub;
  }, []);

  // Load project once auth is resolved
  useEffect(() => {
    if (user === undefined) return; // still loading auth

    const load = async () => {
      try {
        const data = await loadSharedProject(projectId);
        if (!data || data.deleted) {
          setPageState('invalid');
          setErrorMsg('Projeto não encontrado. O link pode ser inválido ou o projeto foi excluído.');
          return;
        }
        if (data.inviteEnabled === false) {
          setPageState('invalid');
          setErrorMsg('Este link de convite foi desativado pelo administrador.');
          return;
        }
        setProject(data);

        if (user) {
          const email = (user.email || '').trim().toLowerCase();
          if (data.memberEmails && data.memberEmails.includes(email)) {
            setPageState('already_member');
          } else {
            setPageState('ready');
          }
        } else {
          setPageState('ready'); // not logged in — page will prompt login
        }
      } catch {
        setPageState('invalid');
        setErrorMsg('Não foi possível carregar o projeto. Tente novamente.');
      }
    };

    load();
  }, [user, projectId]);

  const handleJoin = async () => {
    if (!user) {
      onOpenAuth?.();
      return;
    }
    setPageState('joining');
    try {
      const updatedProject = await joinProjectViaInvite(
        projectId,
        user.email,
        user.displayName || user.email.split('@')[0]
      );

      // Persist project to localStorage so AppContent finds it on redirect
      const existing = JSON.parse(localStorage.getItem('rupt_projects') || '[]');
      const alreadySaved = existing.some((p) => p.id === projectId);
      if (!alreadySaved) {
        const projectToSave = {
          id: updatedProject.id,
          name: updatedProject.name,
          description: updatedProject.description || '',
          displayMode: updatedProject.displayMode || 'LIST',
          color: updatedProject.color || '#4adeb9',
          groupByDay: updatedProject.groupByDay !== false,
          members: updatedProject.members || [],
          adminId: updatedProject.adminId,
          adminEmail: updatedProject.adminEmail,
          kanbanStages: updatedProject.kanbanStages || [],
        };
        localStorage.setItem('rupt_projects', JSON.stringify([...existing, projectToSave]));
      }

      // Also update user's Firestore data so the project appears on other devices
      if (user?.uid) {
        const allProjects = JSON.parse(localStorage.getItem('rupt_projects') || '[]');
        await saveUserData(user.uid, { projects: allProjects });
      }

      setPageState('joined');
      setTimeout(() => navigate(`/projetos/${projectId}`), 1500);
    } catch (err) {
      setPageState('error');
      setErrorMsg(err.message || 'Ocorreu um erro ao entrar no projeto. Tente novamente.');
    }
  };

  // ─── Renders ──────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-spinner" />
          <p className="join-loading-text">Verificando convite…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid' || pageState === 'error') {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-icon join-icon--error">✕</div>
          <h2>Link inválido</h2>
          <p className="join-subtitle">{errorMsg}</p>
          <Link to="/" className="btn-join-home">Ir para o início</Link>
        </div>
      </div>
    );
  }

  if (pageState === 'already_member') {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-icon join-icon--ok">✓</div>
          <h2>Você já é membro</h2>
          <p className="join-subtitle">
            Você já faz parte do projeto <strong>{project?.name}</strong>.
          </p>
          <button className="btn-join-primary" onClick={() => navigate(`/projetos/${projectId}`)}>
            Abrir projeto
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'joined') {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-icon join-icon--ok">✓</div>
          <h2>Bem-vindo ao projeto!</h2>
          <p className="join-subtitle">Você entrou em <strong>{project?.name}</strong>. Redirecionando…</p>
        </div>
      </div>
    );
  }

  // ready | joining
  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-project-color" style={{ background: project?.color || '#4adeb9' }} />
        <h2 className="join-project-name">{project?.name}</h2>
        {project?.description && <p className="join-project-desc">{project.description}</p>}

        <div className="join-meta">
          <span>Administrador: <strong>{project?.adminEmail}</strong></span>
          <span>{(project?.members?.length || 0) + 1} membro{(project?.members?.length || 0) !== 0 ? 's' : ''}</span>
        </div>

        {user ? (
          <>
            <p className="join-subtitle">
              Você receberá acesso como <strong>{user.email}</strong>.
            </p>
            <button
              className="btn-join-primary"
              onClick={handleJoin}
              disabled={pageState === 'joining'}
            >
              {pageState === 'joining' ? 'Entrando…' : 'Entrar no Projeto'}
            </button>
          </>
        ) : (
          <>
            <p className="join-subtitle">
              Faça login ou crie uma conta para entrar neste projeto.
            </p>
            <button className="btn-join-primary" onClick={() => onOpenAuth?.()}>
              Entrar / Cadastrar
            </button>
          </>
        )}

        <Link to="/" className="btn-join-cancel">Cancelar</Link>
      </div>
    </div>
  );
}

export default JoinProjectPage;
