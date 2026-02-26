import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyArAi3sOCt880uzYWCkkbPG1tW4MFDqTf4',
  authDomain: 'rupt-d23ed.firebaseapp.com',
  projectId: 'rupt-d23ed',
  storageBucket: 'rupt-d23ed.firebasestorage.app',
  messagingSenderId: '654858776071',
  appId: '1:654858776071:web:77ff8dc409bb780fcc04a2',
  measurementId: 'G-K104QEMZYS',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
