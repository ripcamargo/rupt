import { useState, useEffect, useRef } from 'react';
import DayGroup from './components/DayGroup';
import TaskItem from './components/TaskItem';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import AuthGate from './components/AuthGate';
import UserProfileModal from './components/UserProfileModal';
import Sidebar from './components/Sidebar';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import { SettingsIcon, MenuIcon } from './components/Icons';
import { formatTime } from './utils/timeFormatter';
import { saveTasks, loadTasks } from './utils/storage';
import { groupTasksByDate, isToday } from './utils/dateGrouping';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './utils/settings';
import { roundSeconds } from './utils/rounding';
import { requestNotificationPermission, notifyTaskReminder } from './utils/notifications';
import { auth } from './utils/firebase';
import { loadUserData, saveUserData, saveSharedProject, loadSharedProjectsForUser, onSharedProjectTasksChange, onUserTasksChange, saveSharedProjectTasks } from './utils/firestore';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import './App.css';

function App() {
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
    members: [],
    adminId: 'local_user',
    adminEmail: 'Anonymous',
  }]);
  const [activeProjectId, setActiveProjectId] = useState('default');
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState(null);
  const inputRef = useRef(null);
  const lastNotificationRef = useRef({});
  const workHoursNotifiedRef = useRef({ lunch: null, exit: null }); // Track if already notified today
  const timerStartRef = useRef(null); // Track when timer started for timestamp-based counting
  const timerBaseDurationRef = useRef(0); // Track base duration when timer starts
  const isHydratingRef = useRef(false);
  const unsubscribeUserTasksRef = useRef(null); // Real-time listener for user's personal tasks
  const unsubscribeSharedProjectRef = useRef(null); // Real-time listener for shared project tasks
  const isReceivingFromListenerRef = useRef(false); // Prevent sync loop when receiving from listener
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
        members: p.members || [],
        adminId: p.adminId || 'local_user',
        adminEmail: p.adminEmail || 'Anonymous',
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
    if (savedActiveProjectId) {
      setActiveProjectId(savedActiveProjectId);
    }
  }, []);

  // Handle Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
        setUserPhoto(null);
        return;
      }

      if (currentUser) {
        isHydratingRef.current = true;
        const localTasks = loadTasks();
        const localSettings = loadSettings();
        const localProjects = JSON.parse(localStorage.getItem('rupt_projects') || '[{"id":"default","name":"Minhas Tarefas","description":"","displayMode":"LIST","color":"#4adeb9","members":[],"adminId":"local_user","adminEmail":"Anonymous"}]');
        const localActiveProjectId = localStorage.getItem('rupt_active_project') || 'default';
        const remoteData = await loadUserData(currentUser.uid);

        // Load shared projects where user is a member
        const sharedProjects = await loadSharedProjectsForUser(currentUser.email);

        if (remoteData) {
          const mergedTasks = mergeTasks(localTasks, remoteData.tasks || []);
          const migratedTasks = migrateTasksWithAssignee(mergedTasks, currentUser.email);
          const mergedSettings = mergeSettings(localSettings, remoteData.settings);
          
          // Start with local projects as base (includes "Minhas Tarefas")
          let allProjects = [...localProjects];
          
          // Merge with remote projects owned by this user
          if (remoteData.projects && remoteData.projects.length > 0) {
            remoteData.projects.forEach(remoteProject => {
              const existingIndex = allProjects.findIndex(p => p.id === remoteProject.id);
              if (existingIndex >= 0) {
                // Update existing project
                allProjects[existingIndex] = remoteProject;
              } else if (remoteProject.id !== 'default') {
                // Add new project (not default)
                allProjects.push(remoteProject);
              }
            });
          }
          
          // Add shared projects that aren't already in the list
          sharedProjects.forEach(sharedProject => {
            if (!allProjects.some(p => p.id === sharedProject.id)) {
              allProjects.push(sharedProject);
            }
          });
          
          // Check for new shared projects and show notification
          checkForNewSharedProjects(allProjects);
          
          const mergedActiveProjectId = remoteData.activeProjectId || localActiveProjectId;
          setTasks(migratedTasks);
          setSettings(mergedSettings);
          setProjects(allProjects);
          setActiveProjectId(mergedActiveProjectId);
          setUserPhoto(remoteData.photoURL || null);
          saveTasks(migratedTasks);
          saveSettings(mergedSettings);
          localStorage.setItem('rupt_projects', JSON.stringify(allProjects));
          localStorage.setItem('rupt_active_project', mergedActiveProjectId);
          await saveUserData(currentUser.uid, {
            tasks: migratedTasks,
            settings: mergedSettings,
            projects: allProjects,
            activeProjectId: mergedActiveProjectId,
            photoURL: remoteData.photoURL,
          });
        } else {
          // No remote data - first time login for this user
          // Initialize with default project and any shared projects
          const migratedLocalTasks = migrateTasksWithAssignee(localTasks, currentUser.email);
          let allProjects = [...localProjects];
          
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
          localStorage.setItem('rupt_projects', JSON.stringify(allProjects));
          console.log('Setting projects on first login:', allProjects);
          
          await saveUserData(currentUser.uid, {
            tasks: migratedLocalTasks,
            settings: localSettings,
            projects: allProjects,
            activeProjectId: localActiveProjectId,
            photoURL: null,
          });
        }

        isHydratingRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

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

    // Determine if current project is shared
    const currentProject = projects.find(p => p.id === activeProjectId);
    const isSharedProject = currentProject && currentProject.members && currentProject.members.length > 0;

    if (isSharedProject && activeProjectId !== 'default') {
      // Setup listener for shared project tasks
      console.log('Setting up listener for shared project:', activeProjectId);
      unsubscribeSharedProjectRef.current = onSharedProjectTasksChange(activeProjectId, (sharedProjectTasks) => {
        // Merge: replace tasks for this project, keep all other project tasks
        setTasks((prevTasks) => {
          const otherProjectTasks = prevTasks.filter(t => t.projectId !== activeProjectId);
          const merged = [...sharedProjectTasks, ...otherProjectTasks];
          console.log(`Merged tasks for shared project ${activeProjectId}: ${merged.length} total`);
          isReceivingFromListenerRef.current = true;
          setTimeout(() => { isReceivingFromListenerRef.current = false; }, 100);
          return merged;
        });
      });
    } else {
      // Setup listener for personal user tasks
      console.log('Setting up listener for user personal tasks');
      unsubscribeUserTasksRef.current = onUserTasksChange(user.uid, (personalTasks) => {
        // Only update if not actively hydrating
        if (!isHydratingRef.current) {
          // Merge: replace personal project tasks, keep shared project tasks
          setTasks((prevTasks) => {
            const sharedProjectTasks = prevTasks.filter(t => {
              const proj = projects.find(p => p.id === t.projectId);
              return proj && proj.members && proj.members.length > 0;
            });
            const merged = [...personalTasks, ...sharedProjectTasks];
            console.log(`Merged personal tasks: ${merged.length} total (${personalTasks.length} personal + ${sharedProjectTasks.length} shared)`);
            isReceivingFromListenerRef.current = true;
            setTimeout(() => { isReceivingFromListenerRef.current = false; }, 100);
            return merged;
          });
        }
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
  }, [user, activeProjectId, projects, authLoading]);

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
    
    // Determine if current project is shared
    const currentProject = projects.find(p => p.id === activeProjectId);
    const isSharedProject = currentProject && currentProject.members && currentProject.members.length > 0;
    
    console.log('syncToFirestore - activeProjectId:', activeProjectId, 'isSharedProject:', isSharedProject, 'currentProject:', currentProject);
    
    try {
      // Save to user's personal data
      await saveUserData(user.uid, {
        tasks: tasksToSync,
        settings: settingsToSync,
        projects,
        activeProjectId,
      });
      
      // If viewing a shared project, also save tasks there (only tasks for this project)
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
    setActiveProjectId(projectId);
    setIsSidebarOpen(false);
  };

  const handleCreateProject = (projectName) => {
    const newProject = {
      id: `project_${Date.now()}`,
      name: projectName,
      description: '',
      displayMode: 'LIST',
      color: '#4adeb9',
      members: [],
      adminId: user?.uid || 'local_user',
      adminEmail: user?.email || 'Anonymous',
    };
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    setActiveProjectId(newProject.id);
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
    
    // If project has members, save it as a shared project in Firestore
    if (updatedProject.members && updatedProject.members.length > 0) {
      console.log('Saving shared project with members:', updatedProject.members);
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

  const handleDeleteProjectFromSettings = (projectId) => {
    // Don't allow deleting the default project
    if (projectId === 'default') return;

    // Delete all tasks from this project
    const updatedTasks = tasks.filter((task) => task.projectId !== projectId);
    setTasks(updatedTasks);
    saveTasks(updatedTasks);

    // Remove project from list
    const updatedProjects = projects.filter((p) => p.id !== projectId);
    setProjects(updatedProjects);
    localStorage.setItem('rupt_projects', JSON.stringify(updatedProjects));

    // If deleting active project, switch to default
    if (activeProjectId === projectId) {
      setActiveProjectId('default');
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

  const handleRenameProject = (projectId, newName) => {
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
    // Task starts running automatically (as it does today)
    const assignedToEmail = user?.email || 'Anonymous';
    
    const newTask = {
      id: Date.now(),
      description: description,
      details: details,
      requester: requester,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      totalDurationSeconds: 0,
      status: 'running', // Always starts running when created
      isUrgent: false,
      customOrderDate: null,
      projectId: activeProjectId,
      assignedTo: assignedToEmail, // Task assigned to creator (current user)
    };

    setTasks((prevTasks) => {
      // Pause current running task if exists
      let updatedTasks = prevTasks;
      if (runningTaskId) {
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

    setRunningTaskId(newTask.id);
    timerBaseDurationRef.current = 0;
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
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, [field]: value }
          : task
      )
    );
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

  // Calculate total time today
  const totalTimeToday = tasks.reduce(
    (sum, task) => sum + (isToday(task.createdAt) ? task.totalDurationSeconds : 0),
    0
  );

  // Filter tasks by active project
  const filteredTasks = tasks.filter((task) => {
    // Tasks created before the project system should default to 'default' project
    const taskProjectId = task.projectId || 'default';
    return taskProjectId === activeProjectId;
  });

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

  // For BLOCKS mode, sort all tasks together instead of grouping by date
  const sortedBlocksTasks = (() => {
    if (displayMode === 'BLOCKS') {
      // 1. Running tasks (top)
      const runningTasks = filteredTasks.filter(task => task.status === 'running');
      
      // 2. Urgent tasks
      const urgentTasks = filteredTasks.filter(
        task => task.status !== 'running' && task.status !== 'completed' && task.isUrgent
      );
      
      // 3. Normal/Paused tasks
      const normalTasks = filteredTasks.filter(
        task => task.status !== 'running' && task.status !== 'completed' && !task.isUrgent
      );
      
      // 4. Completed tasks (bottom)
      const completedTasks = filteredTasks.filter(task => task.status === 'completed');
      
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
          <img src="/rupt-logo.png" alt="Rupt" className="app-logo" />
          <div className="total-time">
            <span className="label">Hoje:</span>
            <span className="time">{formatTime(totalTimeToday)}</span>
          </div>
          <div className="header-actions">
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
            <h1 className="project-name">{projects.find(p => p.id === activeProjectId)?.name}</h1>
            {projects.find(p => p.id === activeProjectId)?.description && (
              <p className="project-description">{projects.find(p => p.id === activeProjectId)?.description}</p>
            )}
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
          {displayMode === 'BLOCKS' ? (
            // BLOCKS MODE: Simple grid layout without day grouping
            sortedBlocksTasks.length === 0 ? (
              <div className="empty-state">
                <p>Nenhuma tarefa no projeto. Crie uma para começar!</p>
              </div>
            ) : (
              <div className="tasks-blocks-grid">
                {sortedBlocksTasks.map((task) => (
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
                  />
                ))}
              </div>
            )
          ) : (
            // LIST MODE: Grouped by date (original behavior)
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
        project={selectedProjectForSettings}
        currentUserId={user?.uid || 'local_user'}
        onUpdate={handleUpdateProject}
        onDelete={handleDeleteProjectFromSettings}
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

export default App;
