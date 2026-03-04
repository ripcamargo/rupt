import { useState, useEffect, useRef } from 'react';
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
  const [debugMode, setDebugMode] = useState(false); // Debug mode to keep popup open
  const [debugLogs, setDebugLogs] = useState([]); // Store debug logs
  const hasInitializedFromStorageRef = useRef(false); // Track if already set user from storage

  const GOOGLE_OAUTH_CLIENT_ID = getGoogleOAuthClientId();

  // Debug helper to log both to console and UI
  const addDebugLog = (message) => {
    console.log(message);
    setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Manual storage check for debugging
  const checkStorageManually = async () => {
    addDebugLog('[DEBUG] Manually checking chrome.storage.local...');
    chrome.storage.local.get(null, (result) => {
      addDebugLog('[DEBUG] All storage keys: ' + Object.keys(result).join(', '));
      if (result.pendingLogin) {
        addDebugLog('[DEBUG] ✓ pendingLogin found! User: ' + result.pendingLogin.user?.email);
      } else {
        addDebugLog('[DEBUG] ✗ pendingLogin NOT found in storage');
      }
    });
  };
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
      // Don't reset user if we already initialized from storage
      // (popup can't actually be logged into Firebase, but we preserve the user from tab login)
      if (!currentUser && hasInitializedFromStorageRef.current) {
        addDebugLog('[Auth] Firebase user null but already initialized from storage, keeping user');
        setLoading(false);
        return;
      }

      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        await loadUserProjects(currentUser);
        await loadRunningTask();
      }
    });

    return () => unsubscribe();
  }, []);

  // Check for pending login when popup opens (from background storage)
  useEffect(() => {
    const logMsg = '[Extension] Checking for pending login in storage...';
    console.log(logMsg);
    addDebugLog(logMsg);
    
    chrome.storage.local.get(['pendingLogin'], async (result) => {
      if (result.pendingLogin) {
        const msg1 = '[Extension] Found pending login, processing...';
        console.log(msg1);
        addDebugLog(msg1);
        
        const { idToken, user: userData, timestamp } = result.pendingLogin;
        
        // Check if login data is not too old (max 5 minutes)
        const isExpired = (Date.now() - timestamp) > 5 * 60 * 1000;
        if (isExpired) {
          const msg2 = '[Extension] Pending login expired, clearing...';
          console.log(msg2);
          addDebugLog(msg2);
          chrome.storage.local.remove(['pendingLogin']);
          return;
        }
        
        try {
          const msg3 = `[Extension] User data from login tab: ${userData.email}`;
          console.log(msg3);
          addDebugLog(msg3);
          
          // Instead of calling signInWithCredential (which causes CORS error),
          // we directly set the user from the login tab data
          // This works because the user already successfully authenticated in the tab
          setUser({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            getIdToken: async () => idToken, // Mock method for getIdToken
          });
          
          // Mark that we've already initialized from storage so auth listener doesn't reset it
          hasInitializedFromStorageRef.current = true;
          
          const msg4 = '[Extension] User set from pending login data';
          console.log(msg4);
          addDebugLog(msg4);
          
          // Clear pending login from storage
          chrome.storage.local.remove(['pendingLogin']);
          
          // Load user projects and running task
          await loadUserProjects({
            uid: userData.uid,
            email: userData.email,
          });
          await loadRunningTask();
          
          // Close the login tab if it's still open
          chrome.tabs.query({ url: 'https://rupt.vercel.app/*' }, (tabs) => {
            tabs.forEach(tab => {
              if (tab.url.includes('mode=extension-login')) {
                chrome.tabs.remove(tab.id);
                const msgTab = `[Extension] Closed login tab: ${tab.id}`;
                console.log(msgTab);
                addDebugLog(msgTab);
              }
            });
          });
          
        } catch (error) {
          const errMsg = `[Extension] Error processing pending login: ${error.message}`;
          console.error(errMsg);
          addDebugLog(errMsg);
          chrome.storage.local.remove(['pendingLogin']);
          setLoginError('Erro ao recuperar dados do login: ' + error.message);
        }
      } else {
        const msg5 = '[Extension] No pending login found';
        console.log(msg5);
        addDebugLog(msg5);
      }
    });
  }, []); // Run only once when popup opens

  // Listen for login messages from content script (for backward compatibility)
  useEffect(() => {
    const handleMessage = async (message, sender, sendResponse) => {
      console.log('[Extension] Received message:', message.type, 'from:', sender);

      if (message.type === 'LOGIN_SUCCESS') {
        console.log('[Extension] Login success message received (should be handled by storage check above)');
        sendResponse({ success: true });
      }

      return true;
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
      console.log('[Extension] Loading projects for user:', currentUser.email);
      
      // For now, just set default project + any cached projects
      // Full project list will sync when app reconnects to main tab
      const defaultProject = {
        id: 'default',
        name: 'Minhas Tarefas',
        color: '#4adeb9'
      };

      setProjects([defaultProject]);
      setRecentTasks([]);
      
      console.log('[Extension] Projects loaded (default only)');
    } catch (error) {
      console.error('[Extension] Error loading projects:', error);
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
      const extensionId = chrome.runtime.id;
      console.log('[Auth] Extension ID:', extensionId);
      const loginUrl = `https://rupt.vercel.app/?mode=extension-login&extensionId=${extensionId}`;
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
    if (!taskDescription.trim() || !user) {
      addDebugLog('[Task] Missing description or user');
      return;
    }

    try {
      addDebugLog('[Task] Adding task: ' + taskDescription);
      addDebugLog('[Task] User UID: ' + user.uid);
      
      // Don't load from Firestore - just save locally to storage
      // The main app will sync when it opens
      
      const newTask = {
        id: Date.now().toString(),
        description: taskDescription.trim(),
        details: taskDetails.trim(),
        projectId: selectedProject,
        status: 'TODO',
        duration: 0,
        createdAt: new Date().toISOString(),
        assignedTo: user.email || 'Anonymous',
        completedAt: null,
        userId: user.uid
      };

      // Start timer immediately
      const taskWithTimer = {
        ...newTask,
        startTime: Date.now()
      };

      // Save to local storage
      const { pendingTasks = [] } = await new Promise(resolve => {
        chrome.storage.local.get(['pendingTasks'], resolve);
      });
      
      const updatedPendingTasks = [newTask, ...pendingTasks];
      await chrome.storage.local.set({ pendingTasks: updatedPendingTasks });
      addDebugLog('[Task] Task saved to chrome.storage.local');

      // Save running task
      await chrome.storage.local.set({ runningTask: taskWithTimer });
      setRunningTask(taskWithTimer);
      addDebugLog('[Task] Timer started locally');

      // But also try to save to Firestore for backwards compatibility
      try {
        const userData = await loadUserData(user.uid);
        const tasks = userData?.tasks || [];
        const updatedTasks = [newTask, ...tasks];
        await saveUserData(user.uid, { tasks: updatedTasks });
        addDebugLog('[Task] Task saved to Firestore');
      } catch (firestoreError) {
        addDebugLog('[Task] Firestore save failed (OK): ' + firestoreError.message);
      }

      // Send message to background to update badge
      chrome.runtime.sendMessage({ type: 'TASK_STARTED' });

      // Clear form
      setTaskDescription('');
      setTaskDetails('');

      // Update recent tasks
      setRecentTasks([newTask, ...recentTasks].slice(0, 3));
      
      addDebugLog('[Task] ✓ Task added successfully');
    } catch (error) {
      const errMsg = '[Task] ✗ Error adding task: ' + error.message;
      console.error(errMsg, error);
      addDebugLog(errMsg);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTask || !user) return;

    try {
      addDebugLog('[Task] Stopping timer for: ' + runningTask.description);
      const elapsed = Math.floor((Date.now() - runningTask.startTime) / 1000);
      addDebugLog('[Task] Elapsed time: ' + elapsed + 's');
      
      // Update task in local storage
      const { pendingTasks = [] } = await new Promise(resolve => {
        chrome.storage.local.get(['pendingTasks'], resolve);
      });
      
      const pendingTaskIndex = pendingTasks.findIndex(t => t.id === runningTask.id);
      addDebugLog('[Task] Pending task found at index: ' + pendingTaskIndex);
      
      if (pendingTaskIndex !== -1) {
        pendingTasks[pendingTaskIndex].duration += elapsed;
        await chrome.storage.local.set({ pendingTasks });
        addDebugLog('[Task] ✓ Task duration updated in storage');
      } else {
        addDebugLog('[Task] Task not in pending list, but that\'s OK - it will sync when app opens');
      }

      // Also try to update in Firestore if it's there
      try {
        const userData = await loadUserData(user.uid);
        const tasks = userData?.tasks || [];
        const taskIndex = tasks.findIndex(t => t.id === runningTask.id);
        
        if (taskIndex !== -1) {
          tasks[taskIndex].duration += elapsed;
          await saveUserData(user.uid, { tasks });
          addDebugLog('[Task] ✓ Task duration updated in Firestore');
        }
      } catch (firestoreError) {
        addDebugLog('[Task] Firestore update skipped (OK): ' + firestoreError.message);
      }

      // Clear running task
      await chrome.storage.local.remove(['runningTask']);
      setRunningTask(null);
      setElapsedTime(0);

      // Send message to background to clear badge
      chrome.runtime.sendMessage({ type: 'TASK_STOPPED' });
      
      addDebugLog('[Task] ✓ Timer stopped');
    } catch (error) {
      const errMsg = '[Task] ✗ Error stopping timer: ' + error.message;
      console.error(errMsg, error);
      addDebugLog(errMsg);
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

        {/* Debug Panel */}
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ccc' }}>
          <button 
            onClick={() => setDebugMode(!debugMode)}
            style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            🐛 {debugMode ? 'Hide' : 'Show'} Debug
          </button>
          
          {debugMode && (
            <>
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                background: '#f5f5f5', 
                border: '1px solid #ddd',
                borderRadius: '3px',
                fontSize: '10px',
                fontFamily: 'monospace',
                maxHeight: '200px',
                overflowY: 'auto',
                color: '#333'
              }}>
                {debugLogs.length === 0 ? (
                  <div>No logs yet...</div>
                ) : (
                  debugLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {log}
                    </div>
                  ))
                )}
              </div>
              
              <button
                onClick={checkStorageManually}
                style={{ marginTop: '8px', fontSize: '10px', padding: '4px 6px', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #999', borderRadius: '2px', width: '100%' }}
              >
                🔍 Check Storage
              </button>
            </>
          )}
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

      {/* Debug Panel */}
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ccc' }}>
        <button 
          onClick={() => setDebugMode(!debugMode)}
          style={{ fontSize: '11px', padding: '4px 8px', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '3px' }}
        >
          🐛 {debugMode ? 'Hide' : 'Show'} Debug
        </button>
        
        {debugMode && (
          <>
            <div style={{ 
              marginTop: '8px', 
              padding: '8px', 
              background: '#f5f5f5', 
              border: '1px solid #ddd',
              borderRadius: '3px',
              fontSize: '10px',
              fontFamily: 'monospace',
              maxHeight: '200px',
              overflowY: 'auto',
              color: '#333'
            }}>
              {debugLogs.length === 0 ? (
                <div>No logs yet...</div>
              ) : (
                debugLogs.map((log, idx) => (
                  <div key={idx} style={{ marginBottom: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
            
            <button
              onClick={checkStorageManually}
              style={{ marginTop: '8px', fontSize: '10px', padding: '4px 6px', cursor: 'pointer', background: '#f0f0f0', border: '1px solid #999', borderRadius: '2px', width: '100%' }}
            >
              🔍 Check Storage
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExtensionPopup;
