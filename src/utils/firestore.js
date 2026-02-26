import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    await setDoc(userRef, payload, { merge: true });
  } catch (error) {
    console.error('Failed to save user data:', error);
  }
};
