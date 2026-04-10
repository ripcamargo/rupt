import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const loadUserData = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data();
    return {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      settings: data.settings || null,
      photoURL: data.photoURL || null,
      projects: Array.isArray(data.projects) ? data.projects : [],
      activeProjectId: data.activeProjectId || 'default',
    };
  } catch (error) {
    console.error('Failed to load user data:', error);
    return null;
  }
};

export const saveUserData = async (uid, data) => {
  try {
    const userRef = doc(db, 'users', uid);
    const payload = {
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      settings: data.settings || null,
      updatedAt: serverTimestamp(),
    };
    if (data.photoURL !== undefined) {
      payload.photoURL = data.photoURL;
    }
    if (data.projects !== undefined) {
      payload.projects = Array.isArray(data.projects) ? data.projects : [];
    }
    if (data.activeProjectId !== undefined) {
      payload.activeProjectId = data.activeProjectId;
    }
    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.error('Failed to save user data:', error);
  }
};

// Save a shared project to Firestore
export const saveSharedProject = async (project) => {
  try {
    const projectRef = doc(db, 'sharedProjects', project.id);
    
    // Extract member emails for easier querying (include admin)
    const normalizedMemberEmails = (project.members || [])
      .map((member) => (member?.email || '').trim().toLowerCase())
      .filter(Boolean);
    const normalizedAdminEmail = (project.adminEmail || '').trim().toLowerCase();
    const memberEmails = Array.from(new Set([
      ...normalizedMemberEmails,
      ...(normalizedAdminEmail ? [normalizedAdminEmail] : []),
    ]));
    
    console.log('Saving shared project:', project.id);
    console.log('Admin ID:', project.adminId);
    console.log('Member emails:', memberEmails);
    
    await setDoc(projectRef, {
      ...project,
      memberEmails, // Add flat array of emails for querying
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    console.log('Successfully saved shared project:', project.id);
  } catch (error) {
    console.error('Failed to save shared project:', error);
    throw error;
  }
};

// Load a specific shared project
export const loadSharedProject = async (projectId) => {
  try {
    const projectRef = doc(db, 'sharedProjects', projectId);
    const snapshot = await getDoc(projectRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data();
  } catch (error) {
    console.error('Failed to load shared project:', error);
    return null;
  }
};

// Load all projects where user is a member (by email)
export const loadSharedProjectsForUser = async (userEmail) => {
  try {
    const projectsRef = collection(db, 'sharedProjects');
    const normalizedEmail = (userEmail || '').trim().toLowerCase();
    console.log('Loading shared projects for:', normalizedEmail);
    const q = query(projectsRef, where('memberEmails', 'array-contains', normalizedEmail));
    const snapshot = await getDocs(q);
    
    const projects = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only include non-deleted projects
      if (!data.deleted) {
        projects.push(data);
      }
    });
    
    console.log('Found shared projects:', projects);
    return projects;
  } catch (error) {
    console.error('Failed to load shared projects:', error);
    return [];
  }
};

// Delete a shared project
export const deleteSharedProject = async (projectId) => {
  try {
    const projectRef = doc(db, 'sharedProjects', projectId);
    await setDoc(projectRef, { deleted: true, deletedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Failed to delete shared project:', error);
  }
};

// Setup real-time listener for a shared project's tasks
export const onSharedProjectTasksChange = (projectId, callback) => {
  try {
    const projectRef = doc(db, 'sharedProjects', projectId);
    
    console.log('Setting up listener for shared project:', projectId);
    
    const unsubscribe = onSnapshot(projectRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        console.log('Shared project tasks updated from listener:', projectId, 'tasks count:', data.tasks?.length || 0);
        callback({ tasks: data.tasks || [], members: data.members || [], memberEmails: data.memberEmails || [] });
      } else {
        console.log('Shared project document does not exist:', projectId);
        callback({ tasks: [], members: [], memberEmails: [] });
      }
    }, (error) => {
      console.error('Error listening to shared project tasks:', projectId, error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Failed to setup shared project listener:', projectId, error);
    return () => {};
  }
};

// Setup real-time listener for user's tasks
export const onUserTasksChange = (uid, callback) => {
  try {
    const userRef = doc(db, 'users', uid);
    
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
          projects: Array.isArray(data.projects) ? data.projects : null,
          settings: data.settings || null,
        });
      }
    }, (error) => {
      console.error('Error listening to user tasks:', error);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('Failed to setup user tasks listener:', error);
    return () => {};
  }
};

// Save tasks to shared project
export const saveSharedProjectTasks = async (projectId, tasks) => {
  try {
    const projectRef = doc(db, 'sharedProjects', projectId);
    console.log(`Saving ${tasks.length} tasks to shared project ${projectId}`);
    await setDoc(projectRef, {
      tasks: tasks,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    console.log(`Successfully saved tasks to shared project ${projectId}`);
  } catch (error) {
    console.error('Failed to save shared project tasks:', error);
    // Non-fatal: don't throw so callers can continue
  }
};

// Join a project via an invite link
export const joinProjectViaInvite = async (projectId, userEmail, userName) => {
  const project = await loadSharedProject(projectId);
  if (!project) throw new Error('Projeto não encontrado. O link pode ser inválido.');
  if (project.inviteEnabled === false) {
    throw new Error('Este link de convite foi desativado pelo administrador.');
  }

  const normalizedEmail = (userEmail || '').trim().toLowerCase();

  // Already a member: just return the project data
  if (project.memberEmails && project.memberEmails.includes(normalizedEmail)) {
    return project;
  }

  const newMember = {
    email: normalizedEmail,
    name: userName || normalizedEmail.split('@')[0],
    joinedAt: new Date().toISOString(),
  };

  const updatedMembers = [...(project.members || []), newMember];
  const updatedMemberEmails = [...(project.memberEmails || []), normalizedEmail];

  const projectRef = doc(db, 'sharedProjects', projectId);
  await setDoc(
    projectRef,
    { members: updatedMembers, memberEmails: updatedMemberEmails, updatedAt: serverTimestamp() },
    { merge: true }
  );

  return { ...project, members: updatedMembers, memberEmails: updatedMemberEmails };
};
