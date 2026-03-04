import { useState, useEffect } from 'react';
import { auth, firebaseInitError } from '../src/utils/firebase';
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider, signOut } from 'firebase/auth';
import { loadUserData, saveUserData, loadSharedProjectsForUser } from '../src/utils/firestore';
import { formatTime } from '../src/utils/timeFormatter';

// Try to get GOOGLE_OAUTH_CLIENT_ID from window.ENV_CONFIG (set by popup.html)
// Fallback to import.meta.env for development
const getGoogleOAuthClientId = () => {
  // First, try window.ENV_CONFIG (loaded from config.js in popup.html)
  if (typeof window !== 'undefined' && window.ENV_CONFIG && window.ENV_CONFIG.VITE_GOOGLE_OAUTH_CLIENT_ID) {
    console.log('[Auth] Using GOOGLE_OAUTH_CLIENT_ID from window.ENV_CONFIG');
    return window.ENV_CONFIG.VITE_GOOGLE_OAUTH_CLIENT_ID;
  }
  
  // Fallback to import.meta.env
  const fallback = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
  if (fallback) {
    console.log('[Auth] Using GOOGLE_OAUTH_CLIENT_ID from import.meta.env');
  }
  return fallback;
};

const ExtensionPopup = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDetails, setTaskDetails] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('default');
  const [runningTask, setRunningTask] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loginError, setLoginError] = useState('');

  const GOOGLE_OAUTH_CLIENT_ID = getGoogleOAuthClientId();

  const toBase64Url = (value) =>
    btoa(value)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const randomNonce = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return toBase64Url(String.fromCharCode(...bytes));
  };

  const launchChromeGoogleAuthFlow = async () => {
    console.log('[Auth] 1. Checking chrome.identity availability...');
    if (!chrome?.identity?.launchWebAuthFlow) {
      throw new Error('API chrome.identity não disponível. Verifique a permissão "identity" no manifest.');
    }

    console.log('[Auth] 2. Checking GOOGLE_OAUTH_CLIENT_ID...');
    if (!GOOGLE_OAUTH_CLIENT_ID) {
      throw new Error('VITE_GOOGLE_OAUTH_CLIENT_ID não configurado no build da extensão.');
    }

    try {
      console.log('[Auth] 3. Generating nonce...');
      const nonce = randomNonce();
      const redirectUri = chrome.identity.getRedirectURL('firebase');
      
      console.log('[Auth] 4. Building auth URL...');
      console.log('[Auth] Redirect URI:', redirectUri);
      const params = new URLSearchParams({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        response_type: 'id_token token',
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        nonce,
        prompt: 'select_account',
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      console.log('[Auth] 5. Auth URL built, launching web auth flow...');

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectedTo) => {
          console.log('[Auth] 6. launchWebAuthFlow callback received');
          if (chrome.runtime.lastError) {
            console.error('[Auth] 6a. Runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!redirectedTo) {
            console.error('[Auth] 6b. No redirect URL received');
            reject(new Error('Fluxo OAuth cancelado ou sem retorno.'));
            return;
          }

          console.log('[Auth] 6c. Redirect URL received');
          resolve(redirectedTo);
        });
      });

      console.log('[Auth] 7. Parsing response...');
      const hashParams = new URL(responseUrl).hash.replace(/^#/, '');
      const tokenData = new URLSearchParams(hashParams);
      const idToken = tokenData.get('id_token');
      const accessToken = tokenData.get('access_token');

      console.log('[Auth] 8. Tokens extracted:', { idToken: !!idToken, accessToken: !!accessToken });
      if (!idToken && !accessToken) {
        throw new Error('Não foi possível obter token Google no retorno OAuth.');
      }

      console.log('[Auth] 9. Creating Firebase credential...');
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      
      console.log('[Auth] 10. Signing in with Firebase...');
      await signInWithCredential(auth, credential);
      
      console.log('[Auth] 11. Login successful!');
    } catch (error) {
      console.error('[Auth] Error in launchChromeGoogleAuthFlow:', error);
      throw error;
    }
  };

  if (firebaseInitError || !auth) {
    return (
      <div className="popup-container">
        <div className="header">
          <h1>⚠️ Configuração Firebase ausente</h1>
        </div>
        <div className="auth-section">
          <p className="auth-submessage">
            Não foi possível iniciar o popup porque faltam variáveis de ambiente <strong>VITE_FIREBASE_*</strong>.
          </p>
          <p className="auth-hint">
            Crie o arquivo <strong>.env.local</strong> na raiz (use <strong>.env.example</strong> como base), rode <strong>npm run build:extension</strong> e recarregue a extensão no Chrome.
          </p>
        </div>
      </div>
    );
  }

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        await loadUserProjects(currentUser);
        await loadRunningTask();
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for login messages from content script (via rupt.vercel.app tab)
  useEffect(() => {
    const handleMessage = async (message, sender, sendResponse) => {
      console.log('[Extension] Received message:', message.type, 'from:', sender);

      if (message.type === 'LOGIN_SUCCESS') {
        console.log('[Extension] Login message received, attempting Firebase sign in');
        
        try {
          // Use the ID token to create a credential and sign in
          const credential = GoogleAuthProvider.credential(message.idToken);
          await signInWithCredential(auth, credential);
          
          console.log('[Extension] Successfully signed in to Firebase');
          sendResponse({ success: true });
        } catch (error) {
          console.error('[Extension] Error signing in with token:', error);
          sendResponse({ success: false, error: error.message });
        }
      }

      return true; // Keep channel open for async response
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Timer updater
  useEffect(() => {
    if (!runningTask) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - runningTask.startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [runningTask]);

  const loadUserProjects = async (currentUser) => {
    try {
      const userData = await loadUserData(currentUser.uid);
      const sharedProjects = await loadSharedProjectsForUser(currentUser.email);
      
      const defaultProject = {
        id: 'default',
        name: 'Minhas Tarefas',
        color: '#4adeb9'
      };

      const allProjects = [
        defaultProject,
        ...(userData?.projects || []).filter(p => p.id !== 'default'),
        ...sharedProjects
      ];

      setProjects(allProjects);
      
      // Load recent tasks
      if (userData?.tasks) {
        const recent = userData.tasks
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3);
        setRecentTasks(recent);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadRunningTask = async () => {
    try {
      const result = await chrome.storage.local.get(['runningTask']);
      if (result.runningTask) {
        setRunningTask(result.runningTask);
      }
    } catch (error) {
      console.error('Error loading running task:', error);
    }
  };

  const handleLogin = async () => {
    console.log('[Auth] ========== handleLogin START ==========');
    setLoginError('');
    console.log('[Auth] state cleared');

    try {
      console.log('[Auth] Step 1: About to create tab');
      // Open the main app in a new tab for login
      // The user logs in there, and Firebase will sync across all tabs
      const loginUrl = 'https://rupt.vercel.app?mode=extension-login';
      console.log('[Auth] Step 2: Login URL set:', loginUrl);
      
      console.log('[Auth] Step 3: Checking chrome.tabs:', typeof chrome?.tabs?.create);
      const tab = await new Promise((resolve, reject) => {
        console.log('[Auth] Step 4: Inside Promise, creating tab...');
        chrome.tabs.create({ 
          url: loginUrl,
          active: true 
        }, (createdTab) => {
          console.log('[Auth] Step 5: Tab creation callback');
          if (chrome.runtime.lastError) {
            console.error('[Auth] chrome.runtime.lastError:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!createdTab) {
            console.error('[Auth] No createdTab returned');
            reject(new Error('Falha ao criar aba'));
          } else {
            console.log('[Auth] Step 6: Tab created successfully, id:', createdTab.id);
            resolve(createdTab);
          }
        });
      });

      console.log('[Auth] Step 7: Opened login tab:', tab.id);

      // Monitor for successful login by checking auth state periodically
      let loginCheckCount = 0;
      const maxChecks = 60; // Check for up to 60 seconds
      
      const loginCheckInterval = setInterval(() => {
        loginCheckCount++;
        
        // If user is now logged in, close the tab
        if (user) {
          console.log('[Auth] Login detected, closing tab');
          clearInterval(loginCheckInterval);
          chrome.tabs.remove(tab.id);
          return;
        }

        // If timeout, stop checking
        if (loginCheckCount >= maxChecks) {
          console.log('[Auth] Login check timeout');
          clearInterval(loginCheckInterval);
          setLoginError('Tempo limite de login excedido. Você foi redirecionado para o app principal — complete o login lá e volte.');
        }
      }, 1000);

    } catch (error) {
      console.error('[Auth] Caught error in handleLogin:', error);
      console.error('[Auth] Error stack:', error?.stack);
      setLoginError(`Erro ao abrir login: ${error?.message || 'Tente novamente.'}`);
    }
    console.log('[Auth] ========== handleLogin END ==========');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRunningTask(null);
      chrome.storage.local.remove(['runningTask']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAddTask = async () => {
    if (!taskDescription.trim() || !user) return;

    try {
      const userData = await loadUserData(user.uid);
      const tasks = userData?.tasks || [];

      const newTask = {
        id: Date.now().toString(),
        description: taskDescription.trim(),
        details: taskDetails.trim(),
        projectId: selectedProject,
        status: 'TODO',
        duration: 0,
        createdAt: new Date().toISOString(),
        assignedTo: user.email || 'Anonymous',
        completedAt: null
      };

      // Start timer immediately
      const taskWithTimer = {
        ...newTask,
        startTime: Date.now()
      };

      await chrome.storage.local.set({ runningTask: taskWithTimer });
      setRunningTask(taskWithTimer);

      // Send message to background to update badge
      chrome.runtime.sendMessage({ type: 'TASK_STARTED' });

      // Save to Firestore
      const updatedTasks = [newTask, ...tasks];
      await saveUserData(user.uid, { tasks: updatedTasks });

      // Clear form
      setTaskDescription('');
      setTaskDetails('');

      // Update recent tasks
      setRecentTasks([newTask, ...recentTasks].slice(0, 3));
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTask || !user) return;

    try {
      const elapsed = Math.floor((Date.now() - runningTask.startTime) / 1000);
      
      // Update task in Firestore
      const userData = await loadUserData(user.uid);
      const tasks = userData?.tasks || [];
      const taskIndex = tasks.findIndex(t => t.id === runningTask.id);
      
      if (taskIndex !== -1) {
        tasks[taskIndex].duration += elapsed;
        await saveUserData(user.uid, { tasks });
      }

      // Clear running task
      await chrome.storage.local.remove(['runningTask']);
      setRunningTask(null);
      setElapsedTime(0);

      // Send message to background to clear badge
      chrome.runtime.sendMessage({ type: 'TASK_STOPPED' });
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  };

  const handleOpenApp = () => {
    const projectPath = selectedProject === 'default' ? '' : `/project/${selectedProject}`;
    chrome.runtime.sendMessage({ 
      type: 'OPEN_APP', 
      url: `https://rupt.vercel.app${projectPath}` 
    });
  };

  if (loading) {
    return (
      <div className="popup-container loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="popup-container">
        <div className="header">
          <h1 className="logo">⚡ Rupt</h1>
          <p className="tagline">Quick Task Timer</p>
        </div>
        
        <div className="auth-section">
          <p className="auth-message">Faça login para adicionar tarefas</p>
          <p className="auth-submessage">Login nativo da extensão (Google OAuth)</p>
          <button onClick={(e) => {
            console.log('[UI] Login button clicked, event:', e);
            handleLogin();
          }} className="btn btn-primary">
            <span className="google-icon">G</span>
            Entrar com Google
          </button>
          {!!loginError && <p className="auth-hint">{loginError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="header">
        <div className="user-section">
          <img 
            src={user.photoURL || 'https://via.placeholder.com/32'} 
            alt="User" 
            className="user-avatar"
          />
          <div className="user-info">
            <span className="user-name">{user.displayName?.split(' ')[0] || 'Usuário'}</span>
            <button onClick={handleLogout} className="btn-link">Sair</button>
          </div>
        </div>
      </div>

      {runningTask ? (
        <div className="running-task-section">
          <div className="timer-display">
            <span className="timer-icon">⏱️</span>
            <span className="timer-value">{formatTime(elapsedTime)}</span>
          </div>
          <div className="task-info">
            <p className="task-description">{runningTask.description}</p>
            {runningTask.details && (
              <p className="task-details">{runningTask.details}</p>
            )}
          </div>
          <button onClick={handleStopTimer} className="btn btn-danger">
            ⏹️ Parar Timer
          </button>
        </div>
      ) : (
        <div className="quick-add-section">
          <h2 className="section-title">Iniciar Nova Tarefa</h2>
          
          <div className="form-group">
            <input
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddTask()}
              placeholder="O que você vai fazer?"
              className="input-text"
              autoFocus
            />
          </div>

          <div className="form-group">
            <input
              type="text"
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              placeholder="Detalhes (opcional)"
              className="input-text input-small"
            />
          </div>

          <div className="form-group">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="input-select"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleAddTask} 
            disabled={!taskDescription.trim()}
            className="btn btn-primary btn-full"
          >
            ▶️ Adicionar e Iniciar
          </button>
        </div>
      )}

      <div className="footer">
        <button onClick={handleOpenApp} className="btn-link btn-open-app">
          🔗 Abrir App Completo
        </button>
      </div>

      {recentTasks.length > 0 && !runningTask && (
        <div className="recent-tasks">
          <h3 className="recent-title">Recentes</h3>
          {recentTasks.map(task => (
            <div key={task.id} className="recent-task-item">
              <span className="recent-task-description">{task.description}</span>
              <span className="recent-task-time">{formatTime(task.duration)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExtensionPopup;
