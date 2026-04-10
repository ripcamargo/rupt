import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Routes, Route, Link } from 'react-router-dom';
import DayGroup from './components/DayGroup';
import TaskItem from './components/TaskItem';
import KanbanBoard from './components/KanbanBoard';
import KanbanStagesBoard from './components/KanbanStagesBoard';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import AuthGate from './components/AuthGate';
import UserProfileModal from './components/UserProfileModal';
import Sidebar from './components/Sidebar';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import JoinProjectPage from './components/JoinProjectPage';
import { SettingsIcon, MenuIcon, FilterIcon } from './components/Icons';
import { formatTime } from './utils/timeFormatter';
import { saveTasks, loadTasks } from './utils/storage';
import { groupTasksByDate, isToday } from './utils/dateGrouping';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './utils/settings';
import { roundSeconds } from './utils/rounding';
import { requestNotificationPermission, notifyTaskReminder } from './utils/notifications';
import { auth } from './utils/firebase';
import { openPip, CHANNEL_NAME } from './utils/pip';
import { loadUserData, saveUserData, saveSharedProject, loadSharedProjectsForUser, onSharedProjectTasksChange, onUserTasksChange, saveSharedProjectTasks, joinProjectViaInvite } from './utils/firestore';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import './App.css';

function AppContent() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  console.log('AppContent render - projectId from URL:', projectId, 'pathname:', location.pathname);
  
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');
  const [runningTaskId, setRunningTaskId] = useState(null);
  const [step, setStep] = useState('description'); // 'description', 'details', or 'requester'
  const [tempDescription, setTempDescription] = useState('');
  const [tempDetails, setTempDetails] = useState(''); // New: task details field
  const [settings, setSettings] = useState(loadSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userPhoto, setUserPhoto] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showEmailBanner, setShowEmailBanner] = useState(true);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newSharedProjectNotification, setNewSharedProjectNotification] = useState(null);
  const [projects, setProjects] = useState([{
    id: 'default',
    name: 'Minhas Tarefas',
    description: '',
    displayMode: 'LIST',
    color: '#4adeb9',
    groupByDay: true,
    members: [],
    adminId: 'local_user',
    adminEmail: 'Anonymous',
  }]);
  const [activeProjectId, setActiveProjectId] = useState('default');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all'); // 'all' or email of specific member
  const [isFiltersOpen, setIsFiltersOpen] = useState(false); // Toggle for filters panel
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState(null);
  const projectsRef = useRef(projects); // Store projects in ref to avoid useEffect dependency
  const inputRef = useRef(null);
  const lastNotificationRef = useRef({});
  const workHoursNotifiedRef = useRef({ lunch: null, exit: null }); // Track if already notified today
  const timerStartRef = useRef(null); // Track when timer started for timestamp-based counting
  const timerBaseDurationRef = useRef(0); // Track base duration when timer starts
  const isHydratingRef = useRef(false);
  const unsubscribeUserTasksRef = useRef(null); // Real-time listener for user's personal tasks
  const unsubscribeSharedProjectRef = useRef(null); // Real-time listener for shared project tasks
  const isReceivingFromListenerRef = useRef(false); // Prevent sync loop when receiving from listener
  const isExtensionLoginModeRef = useRef(false); // Track if we're in extension login mode (survives URL changes)
  const authGateSeenKey = 'rupt_seen_auth_gate';
  const seenSharedProjectsKey = 'rupt_seen_shared_projects'; // Track which shared projects user has seen notification for

  const mergeTasks = (localTasks, remoteTasks) => {
    const existingIds = new Set(remoteTasks.map((task) => task.id));
    const merged = [...remoteTasks];
    localTasks.forEach((task) => {
      if (!existingIds.has(task.id)) {
        merged.push(task);
      }
    });
    return merged;
  };

  // Migrate tasks to add assignedTo field if missing (for backward compatibility)
  const migrateTasksWithAssignee = (tasks, userEmail) => {
    return tasks.map((task) => ({
      ...task,
      assignedTo: task.assignedTo || userEmail || 'Anonymous',
    }));
  };

  // Remove duplicate tasks (by ID) - keep only the first occurrence
  const deduplicateTasks = (tasks) => {
    const seen = new Set();
    const unique = [];
    
    tasks.forEach(task => {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        unique.push(task);
      }
    });
    
    if (unique.length < tasks.length) {
      console.warn(`Removed ${tasks.length - unique.length} duplicate tasks`);
    }
    
    return unique;
  };

  const mergeSettings = (localSettings, remoteSettings) => ({
    ...DEFAULT_SETTINGS,
    ...localSettings,
    ...(remoteSettings || {}),
  });

  // Check for new shared projects and show notification
  const checkForNewSharedProjects = (allProjects) => {
    const seenProjects = JSON.parse(localStorage.getItem(seenSharedProjectsKey) || '[]');
    
    // Find first new shared project not yet seen
    const newProject = allProjects.find(p => {
      const isShared = p.members && p.members.length > 0 && p.id !== 'default';
      const alreadySeen = seenProjects.includes(p.id);
      return isShared && !alreadySeen;
    });
    
    if (newProject) {
      setNewSharedProjectNotification({
        projectId: newProject.id,
        projectName: newProject.name,
      });
    }
  };

  // Load tasks from storage on mount
  useEffect(() => {
    const savedTasks = loadTasks();
    setTasks(savedTasks);
  }, []);

  // Load projects from storage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('rupt_projects');
    const savedActiveProjectId = localStorage.getItem('rupt_active_project');
    
    let projectsToSet = [];
    
    if (savedProjects) {
      const parsed = JSON.parse(savedProjects);
      // Migrate old projects to new schema
      projectsToSet = parsed.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        displayMode: p.displayMode || 'LIST',
        color: p.color || '#4adeb9',
        groupByDay: p.groupByDay !== undefined ? p.groupByDay : true,
        members: p.members || [],
        adminId: p.adminId || 'local_user',
        adminEmail: p.adminEmail || 'Anonymous',
        ...(p.inviteEnabled !== undefined ? { inviteEnabled: p.inviteEnabled } : {}),
        ...(p.kanbanStages ? { kanbanStages: p.kanbanStages } : {}),
        ...(p.adminId && p.adminId !== 'local_user' ? {} : {}),
      }));
    } else {
      // Initialize with default project
      projectsToSet = [{
        id: 'default',
        name: 'Minhas Tarefas',
        description: '',
        displayMode: 'LIST',
        color: '#4adeb9',
        members: [],
        adminId: 'local_user',
        adminEmail: 'Anonymous',
      }];
      // Save to localStorage
      localStorage.setItem('rupt_projects', JSON.stringify(projectsToSet));
      localStorage.setItem('rupt_active_project', 'default');
    }
    
    setProjects(projectsToSet);
    if (savedActiveProjectId && !projectId && location.pathname === '/') {
      // On initial load at root, navigate to last active project if not default
      if (savedActiveProjectId !== 'default') {
        navigate(`/projetos/${savedActiveProjectId}`, { replace: true });
      } else {
        setActiveProjectId('default');
      }
    } else if (savedActiveProjectId) {
      setActiveProjectId(savedActiveProjectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep projectsRef in sync with projects
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Sync URL parameter with active project
  useEffect(() => {
    console.log('URL Sync useEffect - projectId:', projectId, 'location:', location.pathname, 'activeProjectId:', activeProjectId);
    
    // Check if we're at the root path
    if (location.pathname === '/') {
      // Root path is for default project
      console.log('At root path, setting to default');
      if (activeProjectId !== 'default') {
        setActiveProjectId('default');
        localStorage.setItem('rupt_active_project', 'default');
      }
      return;
    }

    // If we have a projectId from URL params
    if (projectId) {
      // Check if project exists
      const projectExists = projects.some(p => p.id === projectId);
      console.log('Checking project:', projectId, 'exists:', projectExists, 'in projects:', projects.map(p => p.id));
      
      if (!projectExists) {
        // Wait for Firebase to finish loading before redirecting.
        // Projects loaded from localStorage may not include shared projects yet.
        if (authLoading) return;
        // Firebase loaded and project still not found — redirect to default
        console.log('Project not found, redirecting to home');
        navigate('/', { replace: true });
        return;
      }

      // Always update active project when projectId changes
      console.log('Setting activeProjectId to:', projectId);
      setActiveProjectId(projectId);
      localStorage.setItem('rupt_active_project', projectId);
    }
  }, [projectId, projects, navigate, location, authLoading]);

  // Handle Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setUserPhoto(null);
        // Clear shared projects on logout, keep only default project
        const defaultProject = [{
          id: 'default',
          name: 'Minhas Tarefas',
          description: '',
          displayMode: 'LIST',
          color: '#4adeb9',
          members: [],
          adminId: 'local_user',
          adminEmail: 'Anonymous',
        }];
        setProjects(defaultProject);
        setActiveProjectId('default');
        localStorage.setItem('rupt_projects', JSON.stringify(defaultProject));
        localStorage.setItem('rupt_active_project', 'default');
        // Navigate to root (default project)
        navigate('/');
        return;
      }

      if (currentUser) {
        isHydratingRef.current = true;
        const localTasks = loadTasks();
        const localSettings = loadSettings();
        const localProjects = JSON.parse(localStorage.getItem('rupt_projects') || '[{"id":"default","name":"Minhas Tarefas","description":"","displayMode":"LIST","color":"#4adeb9","members":[],"adminId":"local_user","adminEmail":"Anonymous"}]');
        const claimedLocalProjects = localProjects.map((project) =>
          project.adminId === 'local_user'
            ? {
                ...project,
                adminId: currentUser.uid,
                adminEmail: currentUser.email || project.adminEmail,
              }
            : project
        );
        const localActiveProjectId = localStorage.getItem('rupt_active_project') || 'default';
        const remoteData = await loadUserData(currentUser.uid);

        // Load shared projects where user is a member
        const sharedProjects = await loadSharedProjectsForUser(currentUser.email);

        if (remoteData) {
          // Firebase is authoritative. Merge only to preserve local-only tasks not yet synced.
          const mergedTasks = mergeTasks(localTasks, remoteData.tasks || []);
          const migratedTasks = migrateTasksWithAssignee(mergedTasks, currentUser.email);
          const cleanedTasks = deduplicateTasks(migratedTasks);
          const mergedSettings = mergeSettings(localSettings, remoteData.settings);

          // Firebase projects are the source of truth.
          // Add any truly local-only projects (created offline, not yet in Firebase).
          let allProjects = remoteData.projects && remoteData.projects.length > 0
            ? [...remoteData.projects]
            : [...claimedLocalProjects];

          // Ensure default project always exists
          if (!allProjects.some(p => p.id === 'default')) {
            allProjects.unshift({
              id: 'default', name: 'Minhas Tarefas', description: '',
              displayMode: 'LIST', color: '#4adeb9', groupByDay: true,
              members: [], adminId: currentUser.uid, adminEmail: currentUser.email || 'Anonymous',
            });
          }

          // Add local-only projects not yet in Firebase (created offline)
          claimedLocalProjects.forEach(localProject => {
            if (localProject.id !== 'default' && !allProjects.some(p => p.id === localProject.id)) {
              allProjects.push(localProject);
            }
          });

          // Add shared projects (joined via invite) not yet in the list
          sharedProjects.forEach(sharedProject => {
            const existingIdx = allProjects.findIndex(p => p.id === sharedProject.id);
            if (existingIdx >= 0) {
              // Replace with latest data from sharedProjects collection
              allProjects[existingIdx] = sharedProject;
            } else {
              allProjects.push(sharedProject);
            }
          });

          // Check for new shared projects and show notification
          checkForNewSharedProjects(allProjects);
          
          const mergedActiveProjectId = remoteData.activeProjectId || localActiveProjectId;
          setTasks(cleanedTasks);
          setSettings(mergedSettings);
          setProjects(allProjects);
          setActiveProjectId(mergedActiveProjectId);
          setUserPhoto(remoteData.photoURL || currentUser.photoURL || null);
          saveTasks(cleanedTasks);
          saveSettings(mergedSettings);
          localStorage.setItem('rupt_projects', JSON.stringify(allProjects));
          localStorage.setItem('rupt_active_project', mergedActiveProjectId);

          const ownedSharedProjects = allProjects.filter(
            (project) => project.adminId === currentUser.uid && project.members && project.members.length > 0
          );
          if (ownedSharedProjects.length > 0) {
            await Promise.all(ownedSharedProjects.map((project) => saveSharedProject(project)));
            await Promise.all(
              ownedSharedProjects.map((project) => {
                const projectTasks = cleanedTasks.filter((task) => task.projectId === project.id);
                return saveSharedProjectTasks(project.id, projectTasks);
              })
            );
          }

          // Filter tasks: only save NON-SHARED project tasks to user's personal data
          const personalTasksOnly = cleanedTasks.filter(t => {
            const taskProject = allProjects.find(p => p.id === t.projectId);
            const isTaskInSharedProject = taskProject && taskProject.members && taskProject.members.length > 0;
            return !isTaskInSharedProject; // Keep only personal project tasks
          });

          console.log(`Hydration: saving ${personalTasksOnly.length} personal tasks (filtered from ${cleanedTasks.length} total)`);

          await saveUserData(currentUser.uid, {
            tasks: personalTasksOnly,
            settings: mergedSettings,
            projects: allProjects,
            activeProjectId: mergedActiveProjectId,
            photoURL: remoteData.photoURL || currentUser.photoURL || null,
          });
        } else {
          // No remote data - first time login for this user
          // Initialize with default project and any shared projects
          const migratedLocalTasks = migrateTasksWithAssignee(localTasks, currentUser.email);
          let allProjects = [...claimedLocalProjects];
          
          console.log('First login - local projects:', localProjects);
          console.log('Shared projects:', sharedProjects);
          
          sharedProjects.forEach(sharedProject => {
            if (!allProjects.some(p => p.id === sharedProject.id)) {
              allProjects.push(sharedProject);
            }
          });
          
          // Check for new shared projects and show notification
          checkForNewSharedProjects(allProjects);
          
          setTasks(migratedLocalTasks);
          setSettings(localSettings);
          setProjects(allProjects);
          setActiveProjectId(localActiveProjectId);
          setUserPhoto(currentUser.photoURL || null);
          localStorage.setItem('rupt_projects', JSON.stringify(allProjects));
          console.log('Setting projects on first login:', allProjects);

          const ownedSharedProjects = allProjects.filter(
            (project) => project.adminId === currentUser.uid && project.members && project.members.length > 0
          );
          if (ownedSharedProjects.length > 0) {
            await Promise.all(ownedSharedProjects.map((project) => saveSharedProject(project)));
            await Promise.all(
              ownedSharedProjects.map((project) => {
                const projectTasks = migratedLocalTasks.filter((task) => task.projectId === project.id);
                return saveSharedProjectTasks(project.id, projectTasks);
              })
            );
          }
          
          await saveUserData(currentUser.uid, {
            tasks: migratedLocalTasks,
            settings: localSettings,
            projects: allProjects,
            activeProjectId: localActiveProjectId,
            photoURL: currentUser.photoURL || null,
          });
        }

        isHydratingRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // Check if extension login mode is active (opened from chrome extension popup)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const isExtensionLogin = params.get('mode') === 'extension-login';
    
    // Remember if we're in extension login mode (survives URL changes)
    if (isExtensionLogin) {
      isExtensionLoginModeRef.current = true;
    }
    
    console.log('[Extension Login] useEffect running - isExtensionLogin:', isExtensionLogin, 'remembered:', isExtensionLoginModeRef.current, 'hasUser:', !!user, 'authLoading:', authLoading, 'userEmail:', user?.email);
    
    if (isExtensionLoginModeRef.current) {
      console.log('[Extension Login] In extension login mode');
      
      // If not logged in, open auth modal
      if (!user && !authLoading) {
        console.log('[Extension Login] User not logged in, opening auth modal');
        setIsAuthModalOpen(true);
      }
      
      // If user just logged in successfully, send credentials to extension
      if (user && !authLoading) {
        console.log('[Extension Login] User logged in, sending credentials to extension');
        
        user.getIdToken().then((idToken) => {
          console.log('[Extension Login] Got ID token, sending to extension');
          
          const message = {
            type: 'LOGIN_SUCCESS',
            idToken: idToken,
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            }
          };
          
          console.log('[Extension Login] Attempting to send message to extension:', message.type);
          
          // Method 1: Try to send directly to extension (if chrome.runtime is available)
          if (window.chrome?.runtime?.sendMessage) {
            // Get extension ID from URL parameter if provided
            const params = new URLSearchParams(window.location.search);
            const extensionId = params.get('extensionId');
            
            console.log('[Extension Login] Full URL:', window.location.href);
            console.log('[Extension Login] Search params:', window.location.search);
            console.log('[Extension Login] Trying direct chrome.runtime.sendMessage, extensionId:', extensionId);
            
            try {
              if (extensionId) {
                chrome.runtime.sendMessage(extensionId, message, (response) => {
                  if (chrome.runtime.lastError) {
                    console.log('[Extension Login] Error with direct message:', chrome.runtime.lastError.message);
                  } else {
                    console.log('[Extension Login] Direct message sent successfully:', response);
                  }
                });
              } else {
                // Try without extension ID (works if called from extension context)
                chrome.runtime.sendMessage(message, (response) => {
                  if (chrome.runtime.lastError) {
                    console.log('[Extension Login] Error with context message:', chrome.runtime.lastError.message);
                  } else {
                    console.log('[Extension Login] Context message sent successfully:', response);
                  }
                });
              }
            } catch (error) {
              console.error('[Extension Login] Exception sending message:', error);
            }
          }
          
          // Method 2: Also broadcast via postMessage as fallback
          window.postMessage({ 
            source: 'rupt-extension-login',
            ...message 
          }, '*');
          
          console.log('[Extension Login] Message posted, tab should close soon');
          
          // Reset the flag so we don't keep sending messages
          isExtensionLoginModeRef.current = false;
        }).catch((error) => {
          console.error('[Extension Login] Error getting ID token:', error);
        });
      }
    }
  }, [location.search, user, authLoading]);

  // Listen for tasks created from PiP mini window
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'CREATE_TASK' && event.data.description?.trim()) {
        createTaskWithData(event.data.description.trim(), '', '');
      }
    };
    return () => channel.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, runningTaskId, settings]);

  // Listen for pending tasks from extension via content script
  useEffect(() => {
    const handleExtensionMessage = async (event) => {
      // Only accept from our own window
      if (event.source !== window) return;
      
      // Check if this is a pending tasks message from content script
      if (event.data && event.data.source === 'rupt-extension-sync' && event.data.type === 'PENDING_TASKS') {
        if (!user) return; // User not logged in yet
        
        const pendingTasks = event.data.pendingTasks || [];
        if (pendingTasks.length === 0) return;

        try {
          // Load user's current tasks
          const userData = await loadUserData(user.uid);
          let tasks = userData?.tasks || [];

          // Merge pending tasks with existing tasks (avoid duplicates)
          pendingTasks.forEach((pendingTask) => {
            const existingIndex = tasks.findIndex(t => t.id === pendingTask.id);
            if (existingIndex >= 0) {
              // Update existing task (merge duration if pending task has more)
              if (pendingTask.duration > tasks[existingIndex].duration) {
                tasks[existingIndex].duration = pendingTask.duration;
              }
            } else {
              // Add new task
              tasks.push(pendingTask);
            }
          });

          // Save merged tasks to Firestore
          await saveUserData(user.uid, { tasks });
          
          // Update local state
          setTasks(tasks);
        } catch (error) {
          console.error('[Extension Sync] Error syncing pending tasks:', error.message);
        }
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    
    return () => {
      window.removeEventListener('message', handleExtensionMessage);
    };
  }, [user]);

  // Refresh shared projects when user returns to the app (so new invites appear without re-login)
  useEffect(() => {
    if (!user || authLoading) return;

    const refreshSharedProjects = async () => {
      const sharedProjects = await loadSharedProjectsForUser(user.email);

      setProjects((prevProjects) => {
        // Keep default + owned projects, replace invited shared projects with fresh query data
        const baseProjects = prevProjects.filter(
          (project) => project.id === 'default' || project.adminId === user.uid
        );

        const mergedProjects = [...baseProjects];
        sharedProjects.forEach((sharedProject) => {
          const existingIndex = mergedProjects.findIndex((project) => project.id === sharedProject.id);
          if (existingIndex >= 0) {
            mergedProjects[existingIndex] = sharedProject;
          } else {
            mergedProjects.push(sharedProject);
          }
        });

        localStorage.setItem('rupt_projects', JSON.stringify(mergedProjects));
        return mergedProjects;
      });
    };

    const handleFocus = () => {
      refreshSharedProjects();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSharedProjects();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, authLoading]);

  // Show auth gate only on the first visit if not logged in
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      setShowAuthGate(false);
      return;
    }
    const hasSeen = localStorage.getItem(authGateSeenKey) === 'true';
    if (!hasSeen) {
      setShowAuthGate(true);
    }
  }, [authLoading, user]);

  // Setup real-time listeners for shared and personal projects
  useEffect(() => {
    if (!user || authLoading || isHydratingRef.current) return;

    // Cleanup old listeners
    if (unsubscribeUserTasksRef.current) {
      unsubscribeUserTasksRef.current();
      unsubscribeUserTasksRef.current = null;
    }
    if (unsubscribeSharedProjectRef.current) {
      unsubscribeSharedProjectRef.current();
      unsubscribeSharedProjectRef.current = null;
    }

    // Determine if current project is shared (using ref to avoid dependency)
    const currentProject = projectsRef.current.find(p => p.id === activeProjectId);
    const isSharedProject = currentProject && (currentProject.members?.length > 0 || currentProject.inviteEnabled === true);

    if (isSharedProject && activeProjectId !== 'default') {
      // Setup listener for shared project tasks
      console.log('Setting up listener for shared project:', activeProjectId);
      unsubscribeSharedProjectRef.current = onSharedProjectTasksChange(activeProjectId, ({ tasks: sharedProjectTasks, members: sharedMembers, memberEmails: sharedMemberEmails }) => {
        // Prevent loop: only update if not currently receiving from listener
        if (isReceivingFromListenerRef.current) {
          console.log('Skipping update - already receiving from listener');
          return;
        }
        
        isReceivingFromListenerRef.current = true;
        
        // Update members if changed
        setProjects((prevProjects) => {
          const updated = prevProjects.map((p) =>
            p.id === activeProjectId
              ? { ...p, members: sharedMembers, memberEmails: sharedMemberEmails }
              : p
          );
          // Persist updated member list to localStorage so admin sees it on reload
          localStorage.setItem('rupt_projects', JSON.stringify(updated));
          return updated;
        });
        
        // Deduplicate incoming tasks (safety check)
        const uniqueSharedTasks = deduplicateTasks(sharedProjectTasks);
        
        // Merge: replace tasks for this project, keep all other project tasks
        setTasks((prevTasks) => {
          const otherProjectTasks = prevTasks.filter(t => t.projectId !== activeProjectId);
          const merged = [...uniqueSharedTasks, ...otherProjectTasks];
          const dedupedMerged = deduplicateTasks(merged);
          console.log(`Merged tasks for shared project ${activeProjectId}: ${uniqueSharedTasks.length} from shared + ${otherProjectTasks.length} from other = ${dedupedMerged.length} total`);
          return dedupedMerged;
        });
        
        // Reset flag after a delay
        setTimeout(() => { 
          isReceivingFromListenerRef.current = false; 
          console.log('Listener flag reset');
        }, 1000);
      });
    } else {
      // Setup listener for personal user tasks
      console.log('Setting up listener for user personal tasks');
      unsubscribeUserTasksRef.current = onUserTasksChange(user.uid, ({ tasks: personalTasks, projects: firestoreProjects }) => {
        // Prevent loop: only update if not currently receiving from listener or hydrating
        if (isReceivingFromListenerRef.current || isHydratingRef.current) {
          console.log('Skipping personal tasks update - receiving or hydrating');
          return;
        }
        
        isReceivingFromListenerRef.current = true;

        // Update projects from Firebase if available (picks up changes from other devices)
        if (firestoreProjects && firestoreProjects.length > 0) {
          setProjects((prevProjects) => {
            // Keep shared projects (not owned by user) + default, merge with Firebase data
            const sharedOnlyProjects = prevProjects.filter(
              (p) => p.id !== 'default' && p.adminId !== user.uid
            );
            const merged = [
              ...firestoreProjects,
              ...sharedOnlyProjects.filter((sp) => !firestoreProjects.some((fp) => fp.id === sp.id)),
            ];
            localStorage.setItem('rupt_projects', JSON.stringify(merged));
            return merged;
          });
        }
        
        // Deduplicate incoming tasks (safety check)
        const uniquePersonalTasks = deduplicateTasks(personalTasks);
        
        // Merge: replace personal project tasks, keep shared project tasks
        setTasks((prevTasks) => {
          const sharedProjectTasks = prevTasks.filter(t => {
            const proj = projectsRef.current.find(p => p.id === t.projectId);
            return proj && proj.members && proj.members.length > 0;
          });
          const merged = [...uniquePersonalTasks, ...sharedProjectTasks];
          const dedupedMerged = deduplicateTasks(merged);
          console.log(`Merged personal tasks: ${uniquePersonalTasks.length} personal + ${sharedProjectTasks.length} shared = ${dedupedMerged.length} total`);
          return dedupedMerged;
        });
        
        // Reset flag after a delay
        setTimeout(() => { 
          isReceivingFromListenerRef.current = false;
          console.log('Listener flag reset');
        }, 1000);
      });
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribeUserTasksRef.current) {
        unsubscribeUserTasksRef.current();
        unsubscribeUserTasksRef.current = null;
      }
      if (unsubscribeSharedProjectRef.current) {
        unsubscribeSharedProjectRef.current();
        unsubscribeSharedProjectRef.current = null;
      }
    };
  }, [user, activeProjectId, authLoading, projects.find(p => p.id === activeProjectId)?.inviteEnabled]);

  // Save tasks to storage whenever they change
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // Update timer for running task using timestamp-based approach
  useEffect(() => {
    if (!runningTaskId) {
      timerStartRef.current = null;
      return;
    }

    // Store the start timestamp
    timerStartRef.current = Date.now();

    const interval = setInterval(() => {
      if (timerStartRef.current) {
        // Calculate elapsed time based on real timestamps
        const currentTime = Date.now();
        const realElapsedMs = currentTime - timerStartRef.current;
        const realElapsedSeconds = Math.floor(realElapsedMs / 1000);
        
        setTasks((prevTasks) =>
          prevTasks.map((task) => {
            if (task.id === runningTaskId && task.status === 'running') {
              return {
                ...task,
                totalDurationSeconds: timerBaseDurationRef.current + realElapsedSeconds,
              };
            }
            return task;
          })
        );
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      timerStartRef.current = null;
    };
  }, [runningTaskId]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if (settings.notificationEnabled) {
      requestNotificationPermission();
    }
  }, [settings.notificationEnabled]);

  // Check for running task and send notifications based on task duration
  useEffect(() => {
    if (!runningTaskId || !settings.notificationEnabled) return;

    const checkAndNotify = () => {
      const runningTask = tasks.find(task => task.id === runningTaskId);
      if (!runningTask) return;

      // Check if we should notify based on task urgency
      const shouldNotify = runningTask.isUrgent 
        ? settings.notifyUrgentTasks 
        : settings.notifyCommonTasks;
      
      if (!shouldNotify) return;

      // Check if we should play sound based on task urgency
      const shouldPlaySound = runningTask.isUrgent
        ? settings.soundUrgentTasks
        : settings.soundCommonTasks;

      const intervalSeconds = settings.notificationInterval * 60;
      const taskDuration = runningTask.totalDurationSeconds;

      // Initialize: calculate next notification based on current task duration
      if (!lastNotificationRef.current[runningTaskId]) {
        // Find the next interval threshold after current duration
        const intervalsCompleted = Math.floor(taskDuration / intervalSeconds);
        lastNotificationRef.current[runningTaskId] = (intervalsCompleted + 1) * intervalSeconds;
      }

      const nextNotificationAt = lastNotificationRef.current[runningTaskId];

      // Check if task has reached the next notification threshold
      if (taskDuration >= nextNotificationAt) {
        notifyTaskReminder(runningTask.description, shouldPlaySound, runningTask.isUrgent);
        // Update to next threshold
        lastNotificationRef.current[runningTaskId] = nextNotificationAt + intervalSeconds;
      }
    };

    const notificationInterval = setInterval(
      checkAndNotify,
      1000 // Check every second for precision
    );

    return () => clearInterval(notificationInterval);
  }, [runningTaskId, tasks, settings.notificationEnabled, settings.notificationInterval, settings.notifyCommonTasks, settings.notifyUrgentTasks, settings.soundCommonTasks, settings.soundUrgentTasks]);

  // Check for work hours notifications (lunch and exit time)
  useEffect(() => {
    if (!settings.workHoursNotification || !runningTaskId) return;

    const checkWorkHours = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDate = now.toDateString();

      // Reset notifications on new day
      if (workHoursNotifiedRef.current.lunch !== currentDate) {
        workHoursNotifiedRef.current.lunch = null;
      }
      if (workHoursNotifiedRef.current.exit !== currentDate) {
        workHoursNotifiedRef.current.exit = null;
      }

      // Helper function to check if current time is 5 minutes before target
      const isAlmostTime = (targetTime) => {
        const [targetHour, targetMinute] = targetTime.split(':').map(Number);
        const targetDate = new Date(now);
        targetDate.setHours(targetHour, targetMinute, 0, 0);
        
        const fiveMinutesBefore = new Date(targetDate.getTime() - 5 * 60 * 1000);
        const fiveMinutesBeforeTime = `${String(fiveMinutesBefore.getHours()).padStart(2, '0')}:${String(fiveMinutesBefore.getMinutes()).padStart(2, '0')}`;
        
        return currentTime === fiveMinutesBeforeTime;
      };

      // Check lunch time
      if (isAlmostTime(settings.lunchTime) && workHoursNotifiedRef.current.lunch !== currentDate) {
        notifyTaskReminder(
          'Quase hora do almoço! Finalize ou pause suas tarefas.',
          true, // always play sound
          true  // use urgent sound
        );
        workHoursNotifiedRef.current.lunch = currentDate;
      }

      // Check exit time
      if (isAlmostTime(settings.exitTime) && workHoursNotifiedRef.current.exit !== currentDate) {
        notifyTaskReminder(
          'Quase hora de sair! Finalize ou pause suas tarefas.',
          true, // always play sound
          true  // use urgent sound
        );
        workHoursNotifiedRef.current.exit = currentDate;
      }
    };

    // Check every minute
    const workHoursInterval = setInterval(checkWorkHours, 60000);
    
    // Check immediately
    checkWorkHours();

    return () => clearInterval(workHoursInterval);
  }, [runningTaskId, settings.workHoursNotification, settings.lunchTime, settings.exitTime]);

  const syncToFirestore = async (tasksToSync, settingsToSync) => {
    if (!user) return;
    
    // Prevent sync during listener updates to avoid loops
    if (isReceivingFromListenerRef.current) {
      console.log('Skipping sync - currently receiving from listener');
      return;
    }
    
    // Determine if current project is shared
    const currentProject = projects.find(p => p.id === activeProjectId);
    const isSharedProject = currentProject && currentProject.members && currentProject.members.length > 0;
    
    console.log('syncToFirestore - activeProjectId:', activeProjectId, 'isSharedProject:', isSharedProject, 'currentProject:', currentProject);
    
    try {
      // Filter tasks: only save NON-SHARED project tasks to user's personal data
      // Shared project tasks should only live in sharedProjects collection
      const personalTasks = tasksToSync.filter(t => {
        const taskProject = projects.find(p => p.id === t.projectId);
        const isTaskInSharedProject = taskProject && taskProject.members && taskProject.members.length > 0;
        return !isTaskInSharedProject; // Keep only personal project tasks
      });
      
      console.log(`Saving to userData: ${personalTasks.length} personal tasks (filtered from ${tasksToSync.length} total)`);
      
      // Save to user's personal data (only personal project tasks)
      await saveUserData(user.uid, {
        tasks: personalTasks,
        settings: settingsToSync,
        projects,
        activeProjectId,
      });
      
      // If viewing a shared project, save tasks there (only tasks for this project)
      if (isSharedProject && activeProjectId !== 'default') {
        const projectTasks = tasksToSync.filter(t => t.projectId === activeProjectId);
        console.log(`Saving ${projectTasks.length} tasks to shared project ${activeProjectId}`);
        await saveSharedProjectTasks(activeProjectId, projectTasks);
      }
    } catch (error) {
      console.error('Error syncing to Firestore:', error);
    }
  };

  // Project management handlers
  const handleSelectProject = (projectId) => {
    if (projectId === 'default') {
      navigate('/');
    } else {
      navigate(`/projetos/${projectId}`);
    }
    setSelectedMemberFilter('all'); // Reset member filter when switching projects
    setIsFiltersOpen(false); // Close filters panel when switching projects
    setIsSidebarOpen(false);
  };

  const handleCreateProject = (projectName) => {
    if (!user) {
      handleOpenAuth();
      return;
    }
    const newProject = {
      id: `project_${Date.now()}`,
      name: projectName,
      description: '',
      displayMode: 'LIST',
      color: '#4adeb9',
      groupByDay: true,
      members: [],
      adminId: user?.uid || 'local_user',
      adminEmail: user?.email || 'Anonymous',
    };
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    // New projects are never default, so always navigate to /projetos/:id
    navigate(`/projetos/${newProject.id}`);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));
    localStorage.setItem('rupt_active_project', newProject.id);
    if (user) {
      saveUserData(user.uid, {
        tasks,
        settings,
        projects: updatedProjects,
        activeProjectId: newProject.id,
      });
    }
  };

  const handleOpenProjectSettings = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    setSelectedProjectForSettings(project);
    setIsProjectSettingsOpen(true);
  };

  const handleUpdateProject = async (updatedProject) => {
    console.log('Updating project:', updatedProject);
    const updatedProjects = projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );
    setProjects(updatedProjects);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));
    
    // Save to Firestore if this is a shared project (has members OR invite is enabled)
    const isSharedProject = (updatedProject.members && updatedProject.members.length > 0) || updatedProject.inviteEnabled === true;
    if (isSharedProject && updatedProject.id !== 'default') {
      console.log('Saving shared project with members:', updatedProject.members);
      
      // Save tasks FIRST to avoid the listener receiving empty tasks when the
      // project document is overwritten. Both writes use merge:true.
      const projectTasks = tasks.filter(t => t.projectId === updatedProject.id);
      console.log(`Saving ${projectTasks.length} tasks for shared project ${updatedProject.id}`);
      await saveSharedProjectTasks(updatedProject.id, projectTasks);
      
      await saveSharedProject(updatedProject);
    }
    
    if (user) {
      console.log('Syncing to Firestore for user:', user.uid);
      saveUserData(user.uid, {
        tasks,
        settings,
        projects: updatedProjects,
        activeProjectId,
      });
    }
  };

  const handleUpdateKanbanStages = (newStages) => {
    const proj = projects.find((p) => p.id === activeProjectId);
    if (!proj) return;
    handleUpdateProject({ ...proj, kanbanStages: newStages });
  };

  const handleDeleteProjectFromSettings = (projectId) => {
    if (projectId === 'default') return;

    // Delete all tasks from this project
    const updatedTasks = tasks.filter((task) => task.projectId !== projectId);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    // Remove project from list
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));

    // If deleting active project, switch to default (root path)
    if (activeProjectId === projectId) {
      navigate('/');
      localStorage.setItem('rupt_active_project', 'default');
    }

    if (user) {
      saveUserData(user.uid, {
        tasks: updatedTasks,
        settings,
        projects: updatedProjects,
        activeProjectId: activeProjectId === projectId ? 'default' : activeProjectId,
      });
    }
  };

  const handleLeaveProject = async (projectId) => {
    if (!user) return;
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Remove user from project members
    const updatedMembers = (project.members || []).filter(m => m.email !== user.email);
    const updatedProject = { ...project, members: updatedMembers };

    // Update shared project in Firestore (remove this user from members)
    await saveSharedProject(updatedProject);

    // Remove project from local list (user no longer has access)
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));

    // Remove tasks from this project from local state
    const updatedTasks = tasks.filter(t => t.projectId !== projectId);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    // If leaving active project, navigate to default
    const newActiveProjectId = activeProjectId === projectId ? 'default' : activeProjectId;
    if (activeProjectId === projectId) {
      setActiveProjectId('default');
      localStorage.setItem('rupt_active_project', 'default');
      navigate('/');
    }

    // Update user data in Firestore
    if (user) {
      await saveUserData(user.uid, {
        tasks: updatedTasks,
        settings,
        projects: updatedProjects,
        activeProjectId: newActiveProjectId,
      });
    }
  };

  const handleRenameProject = (projectId, newName) => {
    if (projectId === 'default') return;
    const updatedProjects = projects.map((p) =>
      p.id === projectId ? { ...p, name: newName } : p
    );
    setProjects(updatedProjects);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));
    if (user) {
      saveUserData(user.uid, {
        tasks,
        settings,
        projects: updatedProjects,
        activeProjectId,
      });
    }
  };

  const createTask = (e) => {
    e.preventDefault();
    if (input.trim() || (step === 'details' && !settings.requireDetails) || (step === 'requester' && !settings.requireRequester)) {
      if (step === 'description') {
        // First step: save description and decide next step
        const description = input.trim();
        setTempDescription(description);
        setInput('');
        
        // Check if we need details step
        if (settings.requireDetails) {
          setStep('details');
        } else {
          setTempDetails('');
          // Check if we need requester step
          if (settings.requireRequester) {
            setStep('requester');
          } else {
            // Create task directly with values
            createTaskWithData(description, '', '');
          }
        }
      } else if (step === 'details') {
        // Second step: save details and move to requester step (or skip if not required)
        const details = input.trim();
        setTempDetails(details);
        setInput('');
        if (settings.requireRequester) {
          setStep('requester');
        } else {
          // Create task without requester
          createTaskWithData(tempDescription, details, '');
        }
      } else {
        // Third step: create task with all data
        createTaskWithData(tempDescription, tempDetails, input.trim());
      }
      inputRef.current?.focus();
    }
  };

  const createTaskWithData = (description, details, requester) => {
    const currentProject = projects.find(p => p.id === activeProjectId);
    const isDefaultProject = activeProjectId === 'default';
    
    // Always assign task to current user when creating
    const assignedToEmail = user?.email || 'Anonymous';

    // In KANBAN_STAGES mode, new tasks land in the first stage.
    // If that stage has countsTime === false, start the task paused.
    const projectDisplayMode = currentProject?.displayMode || 'LIST';
    const firstStage = currentProject?.kanbanStages?.[0];
    const shouldAutoStart =
      projectDisplayMode !== 'KANBAN_STAGES' || firstStage?.countsTime !== false;
    
    const newTask = {
      id: Date.now(),
      description: description,
      details: details,
      requester: requester,
      createdAt: new Date().toISOString(),
      startedAt: shouldAutoStart ? new Date().toISOString() : null,
      totalDurationSeconds: 0,
      status: shouldAutoStart ? 'running' : 'paused',
      isUrgent: false,
      customOrderDate: null,
      projectId: activeProjectId,
      assignedTo: assignedToEmail,
    };

    setTasks((prevTasks) => {
      // Pause current running task only if the new task will also run
      let updatedTasks = prevTasks;
      if (shouldAutoStart && runningTaskId) {
        updatedTasks = prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        );
      }

      const newTasksList = [newTask, ...updatedTasks];
      // Sync to Firestore
      syncToFirestore(newTasksList, settings);
      return newTasksList;
    });

    if (shouldAutoStart) {
      setRunningTaskId(newTask.id);
      timerBaseDurationRef.current = 0;
    }
    setInput('');
    setStep('description');
    setTempDescription('');
    setTempDetails('');
  };

  const startTask = (taskId) => {
    // Find the task to get its current duration
    const taskToStart = tasks.find(t => t.id === taskId);
    if (taskToStart) {
      timerBaseDurationRef.current = taskToStart.totalDurationSeconds;
    }

    setTasks((prevTasks) => {
      let updatedTasks = prevTasks;

      // Pause current running task
      if (runningTaskId && runningTaskId !== taskId) {
        updatedTasks = prevTasks.map((task) =>
          task.id === runningTaskId
            ? { ...task, status: 'paused' }
            : task
        );
      }

      // Start the new task
      updatedTasks = updatedTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'running',
              startedAt: new Date().toISOString(),
            }
          : task
      );

      // Sync to Firestore
      syncToFirestore(updatedTasks, settings);
      return updatedTasks;
    });

    setRunningTaskId(taskId);
  };

  const pauseTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      );
      // Sync to Firestore after pause
      syncToFirestore(updated, settings);
      return updated;
    });
    setRunningTaskId(null);
    timerBaseDurationRef.current = 0;
    // Clear notification reference when task pauses
    delete lastNotificationRef.current[taskId];
  };

  const completeTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) => {
        if (task.id === taskId) {
          // Don't apply rounding if task was manually edited
          const roundedSeconds = task.manuallyEdited 
            ? task.totalDurationSeconds
            : roundSeconds(
                task.totalDurationSeconds,
                settings.roundingMode,
                settings.roundingStep
              );
          return {
            ...task,
            totalDurationSeconds: roundedSeconds,
            status: 'completed',
          };
        }
        return task;
      });
      // Sync to Firestore after complete
      syncToFirestore(updated, settings);
      return updated;
    });
    if (runningTaskId === taskId) {
      setRunningTaskId(null);
      timerBaseDurationRef.current = 0;
    }
    // Clear notification reference when task completes
    delete lastNotificationRef.current[taskId];
  };

  const toggleUrgent = (taskId) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { 
              ...task, 
              isUrgent: !task.isUrgent,
              // Urgent tasks will automatically position below running due to status sorting
            }
          : task
      )
    );
  };

  const updateTask = (taskId, field, value) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, [field]: value }
          : task
      );
      return updated;
    });
  };

  const assignTask = (taskId, assignedToEmail) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, assignedTo: assignedToEmail }
          : task
      );
      // Sync to Firestore after assigning
      syncToFirestore(updated, settings);
      return updated;
    });
  };

  const editTaskTime = (taskId, newSeconds) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) => {
        if (task.id === taskId) {
          // Add marker to details (description field) if not already present
          const marker = '*Contador manipulado manualmente';
          let newDetails = task.details || '';
          
          if (!newDetails.includes(marker)) {
            // Add marker at the end
            if (newDetails.trim()) {
              newDetails = newDetails.trim() + ' ' + marker;
            } else {
              newDetails = marker;
            }
          }
          
          return {
            ...task,
            totalDurationSeconds: newSeconds,
            manuallyEdited: true,
            details: newDetails,
          };
        }
        return task;
      });
      // Sync to Firestore after manual edit
      syncToFirestore(updated, settings);
      return updated;
    });
  };

  const reopenTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: 'paused' } : task
      );
      // Sync to Firestore
      syncToFirestore(updated, settings);
      return updated;
    });
  };

  const deleteTask = (taskId) => {
    setTasks((prevTasks) => {
      const updated = prevTasks.filter((task) => task.id !== taskId);
      // Sync to Firestore after delete
      syncToFirestore(updated, settings);
      return updated;
    });
    if (runningTaskId === taskId) {
      setRunningTaskId(null);
    }
    // Clear notification reference when task is deleted
    delete lastNotificationRef.current[taskId];
  };

  const reorderTasks = (reorderedTasks) => {
    setTasks(reorderedTasks);
    // Sync reordering to Firestore
    syncToFirestore(reorderedTasks, settings);
  };

  const handleSaveSettings = (newSettings, newTasks = []) => {
    // Merge new tasks if any
    let updatedTasks = tasks;
    if (newTasks.length > 0) {
      updatedTasks = [...tasks, ...newTasks];
      setTasks(updatedTasks);
      saveTasks(updatedTasks);
    }
    
    setSettings(newSettings);
    saveSettings(newSettings);
    // Sync settings to Firestore
    syncToFirestore(updatedTasks, newSettings);
  };

  const handleOpenAuth = () => {
    localStorage.setItem(authGateSeenKey, 'true');
    setShowAuthGate(false);
    setIsAuthModalOpen(true);
  };

  const handleUseWithoutLogin = () => {
    localStorage.setItem(authGateSeenKey, 'true');
    setShowAuthGate(false);
  };

  const handleResendVerificationEmail = async () => {
    if (!user || isResendingEmail) return;
    
    setIsResendingEmail(true);
    try {
      // Configurações do email de verificação
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: false,
      };
      
      await sendEmailVerification(user, actionCodeSettings);
      alert('✅ Email de verificação enviado com sucesso! Verifique sua caixa de entrada e pasta de spam.');
    } catch (err) {
      alert('❌ Erro ao enviar email. Tente novamente mais tarde.');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleDismissEmailBanner = () => {
    setShowEmailBanner(false);
  };

  const handleDismissSharedProjectNotification = () => {
    if (newSharedProjectNotification) {
      // Mark this project as seen
      const seenProjects = JSON.parse(localStorage.getItem(seenSharedProjectsKey) || '[]');
      seenProjects.push(newSharedProjectNotification.projectId);
      localStorage.setItem(seenSharedProjectsKey, JSON.stringify(seenProjects));
      setNewSharedProjectNotification(null);
    }
  };

  const handleOpenSharedProject = () => {
    if (newSharedProjectNotification) {
      handleSelectProject(newSharedProjectNotification.projectId);
      handleDismissSharedProjectNotification();
    }
  };

  const handleReloadUser = async () => {
    if (user) {
      await user.reload();
      setUser({ ...auth.currentUser });
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="auth-loading-spinner" />
          <p>Carregando sua conta...</p>
        </div>
      </div>
    );
  }

  // Calculate total time today
  const totalTimeToday = tasks.reduce(
    (sum, task) => sum + (isToday(task.createdAt) ? task.totalDurationSeconds : 0),
    0
  );

  // Filter tasks by active project
  const filteredTasks = tasks.filter((task) => {
    // Tasks created before the project system should default to 'default' project
    const taskProjectId = task.projectId || 'default';
    
    // Filter by project
    if (taskProjectId !== activeProjectId) return false;
    
    // Filter by member (only for non-default projects)
    if (activeProjectId !== 'default' && selectedMemberFilter !== 'all') {
      const taskAssignee = task.assignedTo || user?.email || 'Anonymous';
      if (taskAssignee !== selectedMemberFilter) return false;
    }
    
    return true;
  });
  
  console.log('Filtered tasks:', filteredTasks.length, 'for activeProjectId:', activeProjectId, 'total tasks:', tasks.length);

  // Get active project for display mode
  const activeProject = projects.find(p => p.id === activeProjectId);
  const displayMode = activeProject?.displayMode || 'LIST';

  // Group tasks by date
  const groupedTasks = groupTasksByDate(filteredTasks);
  
  // Sort tasks within each day with smart ordering
  const sortedGroupedTasks = Object.keys(groupedTasks).reduce((acc, dateKey) => {
    const tasksForDate = groupedTasks[dateKey];
    
    // 1. Running tasks (top absolute)
    const runningTasks = tasksForDate.filter(task => task.status === 'running');
    
    // 2. Urgent tasks (below running)
    const urgentTasks = tasksForDate.filter(
      task => task.status !== 'running' && task.status !== 'completed' && task.isUrgent
    );
    
    // 3. Normal/Paused tasks (draggable, keep their order)
    const normalTasks = tasksForDate.filter(
      task => task.status !== 'running' && task.status !== 'completed' && !task.isUrgent
    );
    
    // 4. Completed tasks (bottom absolute)
    const completedTasks = tasksForDate.filter(task => task.status === 'completed');
    
    // Combine in order
    acc[dateKey] = [...runningTasks, ...urgentTasks, ...normalTasks, ...completedTasks];
    
    return acc;
  }, {});

  // For ungrouped mode (when groupByDay is false) or BLOCKS mode, sort all tasks together instead of grouping by date
  const sortedUngroupedTasks = (() => {
    const shouldCalculate = !activeProject?.groupByDay || displayMode === 'BLOCKS';
    
    if (shouldCalculate) {
      // 1. Running tasks (top)
      const runningTasks = filteredTasks
        .filter(task => task.status === 'running')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // 2. Urgent tasks
      const urgentTasks = filteredTasks
        .filter(task => task.status !== 'running' && task.status !== 'completed' && task.isUrgent)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // 3. Normal/Paused tasks
      const normalTasks = filteredTasks
        .filter(task => task.status !== 'running' && task.status !== 'completed' && !task.isUrgent)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // 4. Completed tasks (bottom)
      const completedTasks = filteredTasks
        .filter(task => task.status === 'completed')
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      return [...runningTasks, ...urgentTasks, ...normalTasks, ...completedTasks];
    }
    return [];
  })();
  
  
  const dateKeys = Object.keys(sortedGroupedTasks);
  const currentProject = projects.find(p => p.id === activeProjectId);
  const projectColor = currentProject?.color || '#4adeb9';

  return (
    <div className="app-container" style={{ '--projectColor': projectColor }}>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onRenameProject={handleRenameProject}
        onOpenProjectSettings={handleOpenProjectSettings}
        isLoggedIn={!!user}
        onOpenAuth={handleOpenAuth}
      />
      <AuthGate
        isOpen={showAuthGate}
        onUseWithoutLogin={handleUseWithoutLogin}
        onSignUp={handleOpenAuth}
      />
      <header className="app-header">
        <div className="header-content">
          <button 
            className="btn-menu" 
            onClick={() => setIsSidebarOpen(true)}
            title="Menu de Projetos"
          >
            <MenuIcon size={20} />
          </button>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/rupt-logo.png" alt="Rupt" className="app-logo" />
          </Link>
          <div className="total-time">
            <span className="label">Hoje:</span>
            <span className="time">{formatTime(totalTimeToday)}</span>
          </div>
          <div className="header-actions">
            {window.documentPictureInPicture && (
              <button
                className="btn-pip"
                onClick={() => openPip(projects.find(p => p.id === activeProjectId)?.name, () => {})}
                title="Abrir mini janela flutuante"
              >
                ⊡
              </button>
            )}
            {user ? (
              <div className="user-status" onClick={() => setIsProfileModalOpen(true)} style={{ cursor: 'pointer' }}>
                {userPhoto ? (
                  <img className="user-photo" src={userPhoto} alt="Usuario" />
                ) : (
                  <span className="user-avatar">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="user-name">
                  {user.displayName || user.email}
                </span>
                <button
                  className="btn-settings"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsSettingsOpen(true);
                  }}
                  title="Configurações"
                >
                  <SettingsIcon size={18} />
                </button>
              </div>
            ) : (
              <>
                <button className="btn-auth-ghost" onClick={handleOpenAuth}>
                  Entrar / Cadastre-se
                </button>
                <button
                  className="btn-settings"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Configurações"
                >
                  <SettingsIcon size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {user && !user.emailVerified && showEmailBanner && (
        <div className="email-verification-banner">
          <div className="banner-content">
            <span className="banner-icon">✉️</span>
            <div className="banner-text">
              <strong>Email não verificado</strong>
              <span>Verifique seu email para garantir acesso completo à sua conta.</span>
            </div>
            <div className="banner-actions">
              <button 
                className="banner-btn-resend" 
                onClick={handleResendVerificationEmail}
                disabled={isResendingEmail}
              >
                {isResendingEmail ? 'Enviando...' : 'Reenviar email'}
              </button>
              <button className="banner-btn-reload" onClick={handleReloadUser} title="Já verifiquei">
                ✓
              </button>
              <button className="banner-btn-close" onClick={handleDismissEmailBanner} title="Fechar">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {newSharedProjectNotification && (
        <div className="shared-project-notification-banner">
          <div className="banner-content">
            <span className="banner-icon">👥</span>
            <div className="banner-text">
              <strong>Você foi adicionado a um novo projeto</strong>
              <span>{newSharedProjectNotification.projectName}</span>
            </div>
            <div className="banner-actions">
              <button 
                className="banner-btn-primary" 
                onClick={handleOpenSharedProject}
              >
                Abrir Projeto
              </button>
              <button className="banner-btn-close" onClick={handleDismissSharedProjectNotification} title="Fechar">
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Header */}
      {projects.find(p => p.id === activeProjectId)?.id !== 'default' && projects.find(p => p.id === activeProjectId) && (
        <div className="project-header">
          <div className="project-header-content">
            <div className="project-header-text">
              <h1 className="project-title">{projects.find(p => p.id === activeProjectId)?.name}</h1>
              {projects.find(p => p.id === activeProjectId)?.description && (
                <p className="project-description">{projects.find(p => p.id === activeProjectId)?.description}</p>
              )}
            </div>
            <button 
              className={`btn-toggle-filters ${isFiltersOpen ? 'active' : ''}`}
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              title="Filtros"
            >
              <FilterIcon size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Filters Panel - Only for non-default projects */}
      {activeProjectId !== 'default' && activeProject && isFiltersOpen && (
        <div className="filters-panel">
          <div className="filters-content">
            <div className="filter-group">
              <label htmlFor="member-filter" className="filter-label">
                Responsável:
              </label>
              <select
                id="member-filter"
                className="filter-select"
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {/* Admin */}
                <option value={activeProject.adminEmail}>
                  {activeProject.adminEmail === user?.email 
                    ? `${user?.displayName || user?.email?.split('@')[0]} (ADM)` 
                    : `${(() => {
                        const adminMember = activeProject.members?.find(m => m.email === activeProject.adminEmail);
                        return adminMember?.name || activeProject.adminEmail?.split('@')[0] || 'Admin';
                      })()} (ADM)`}
                </option>
                {/* Members - exclude admin if they are in members list */}
                {activeProject.members?.filter(m => m.email !== activeProject.adminEmail).map((member, index) => (
                  <option key={index} value={member.email}>
                    {member.email === user?.email 
                      ? (user?.displayName || user?.email?.split('@')[0]) 
                      : member.name || member.email?.split('@')[0] || member.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <main className="app-main">
        <form className="task-input-form" onSubmit={createTask}>
          {step === 'description' ? (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite o assunto da tarefa e pressione Enter..."
              className="task-input"
              autoFocus
            />
          ) : step === 'details' ? (
            <div className="task-creation-row">
              <div className="task-preview">
                <span className="task-preview-label">Assunto:</span>
                <span className="task-preview-text">{tempDescription}</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={settings.requireDetails ? "Descrição detalhada..." : "Descrição (opcional)..."}
                className="task-input"
                autoFocus
              />
              <button type="submit" className="btn-create">
                {settings.requireRequester ? 'Avançar' : 'Criar'}
              </button>
            </div>
          ) : (
            <div className="task-creation-row">
              <div className="task-preview">
                <span className="task-preview-label">Assunto:</span>
                <span className="task-preview-text">{tempDescription}</span>
                {tempDetails && (
                  <>
                    <span className="task-preview-label"> • </span>
                    <span className="task-preview-text">{tempDetails}</span>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={settings.requireRequester ? "Nome do solicitante..." : "Solicitante (opcional)..."}
                className="task-input requester-input"
                autoFocus
              />
              <button type="submit" className="btn-create">
                Criar
              </button>
            </div>
          )}
        </form>

        <div className="tasks-list">
          {displayMode === 'KANBAN_STAGES' ? (
            // KANBAN STAGES MODE: Display tasks in custom workflow stage columns
            <KanbanStagesBoard
              tasks={filteredTasks}
              runningTaskId={runningTaskId}
              onStart={startTask}
              onPause={pauseTask}
              onComplete={completeTask}
              onToggleUrgent={toggleUrgent}
              onReopen={reopenTask}
              onDelete={deleteTask}
              onUpdateTask={updateTask}
              onEditTime={editTaskTime}
              currentProject={activeProject}
              isDefaultProject={activeProjectId === 'default'}
              currentUserEmail={user?.email || 'Anonymous'}
              currentUserDisplayName={user?.displayName || user?.email?.split('@')[0] || ''}
              onUpdateStages={handleUpdateKanbanStages}
            />
          ) : displayMode === 'KANBAN' ? (
            // KANBAN MODE: Display tasks in columns by assignee
            activeProject && activeProject.members && activeProject.members.length > 0 ? (
              <KanbanBoard
                tasks={filteredTasks}
                runningTaskId={runningTaskId}
                onStart={startTask}
                onPause={pauseTask}
                onComplete={completeTask}
                onToggleUrgent={toggleUrgent}
                onReopen={reopenTask}
                onDelete={deleteTask}
                onUpdateTask={updateTask}
                onEditTime={editTaskTime}
                onAssignTask={assignTask}
                currentProject={activeProject}
                isDefaultProject={activeProjectId === 'default'}
                currentUserEmail={user?.email || 'Anonymous'}
                currentUserDisplayName={user?.displayName || user?.email?.split('@')[0] || ''}
              />
            ) : (
              <div className="empty-state">
                <p>O modo Kanban está disponível apenas para projetos compartilhados com membros.</p>
                <p>Adicione membros nas configurações do projeto para usar este modo.</p>
              </div>
            )
          ) : !activeProject?.groupByDay ? (
            // NO GROUPING: Render all tasks without day groups
            filteredTasks.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma tarefa no projeto. Crie uma para começar!</p>
              </div>
            ) : (
              <div className={displayMode === 'BLOCKS' ? 'tasks-blocks-grid' : 'tasks-list-ungrouped'}>
                {sortedUngroupedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    isRunning={runningTaskId === task.id}
                    elapsedSeconds={0}
                    onStart={() => startTask(task.id)}
                    onPause={() => pauseTask(task.id)}
                    onComplete={() => completeTask(task.id)}
                    onToggleUrgent={() => toggleUrgent(task.id)}
                    onReopen={() => reopenTask(task.id)}
                    isEditMode={false}
                    onDelete={() => deleteTask(task.id)}
                    onUpdateTask={updateTask}
                    onEditTime={editTaskTime}
                    isDragging={false}
                    isDragOver={false}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDragLeave={() => {}}
                    onDrop={() => {}}
                    onDragEnd={() => {}}
                    isDefaultProject={activeProjectId === 'default'}
                    currentProject={activeProject}
                    currentUserEmail={user?.email || 'Anonymous'}
                    currentUserDisplayName={user?.displayName || user?.email?.split('@')[0] || ''}
                  />
                ))}
              </div>
            )
          ) : (
            // GROUPED BY DAY: Use DayGroup component
            dateKeys.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma tarefa ainda. Crie uma para começar!</p>
              </div>
            ) : (
              dateKeys.map((dateKey) => {
                const currentProject = projects.find(p => p.id === activeProjectId);
                const isDefaultProject = activeProjectId === 'default';
                return (
                  <DayGroup
                    key={dateKey}
                    dateKey={dateKey}
                    tasks={sortedGroupedTasks[dateKey]}
                    runningTaskId={runningTaskId}
                    onStart={startTask}
                    onPause={pauseTask}
                    onComplete={completeTask}
                    onToggleUrgent={toggleUrgent}
                    onReopen={reopenTask}
                    onDelete={deleteTask}
                    onReorderTasks={reorderTasks}
                    onUpdateTask={updateTask}
                    onEditTime={editTaskTime}
                    currentProject={currentProject}
                    isDefaultProject={isDefaultProject}
                    currentUserEmail={user?.email || 'Anonymous'}
                    currentUserDisplayName={user?.displayName || user?.email?.split('@')[0] || ''}
                    displayMode={displayMode}
                  />
                );
              })
            )
          )}
        </div>
      </main>

      <footer className="app-footer">
        <p>
          1º Enter: Assunto
          {settings.requireDetails && ' • 2º Enter: Descrição'}
          {settings.requireRequester && ` • ${settings.requireDetails ? '3º' : '2º'} Enter: Solicitante`}
          {' • Duplo clique para editar • Ícone de alerta marca como urgente'}
        </p>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
        allTasks={tasks}
        isLoggedIn={!!user}
      />

      <ProjectSettingsModal
        isOpen={isProjectSettingsOpen}
        onClose={() => setIsProjectSettingsOpen(false)}
        project={selectedProjectForSettings ? (projects.find(p => p.id === selectedProjectForSettings.id) || selectedProjectForSettings) : null}
        currentUserId={user?.uid || 'local_user'}
        user={user}
        onOpenAuth={handleOpenAuth}
        onUpdate={handleUpdateProject}
        onDelete={handleDeleteProjectFromSettings}
        onLeaveProject={handleLeaveProject}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <UserProfileModal
        isOpen={isProfileModalOpen}
        user={user}
        userPhoto={userPhoto}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );

}

function App() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/projetos/:projectId" element={<AppContent />} />
      <Route
        path="/convite/:projectId"
        element={
          <>
            <JoinProjectPage onOpenAuth={() => setIsAuthModalOpen(true)} />
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
          </>
        }
      />
    </Routes>
  );
}

export default App;
