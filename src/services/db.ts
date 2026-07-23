import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { DailySnapshot } from './gamification';

export interface UserData {
  goals: any[];
  habits: any[];
  pomodoroMinutes: number;
  pomodoroSessions: number;
  lastResetDate?: string;
  streakCount?: number;
  lastCompletedDate?: string;
  weeklyHistory?: DailySnapshot[];
  totalXp?: number;
}

/**
 * Saves user productivity data directly to Firestore.
 * Path: users/{uid}
 */
export const saveUserData = async (uid: string, data: UserData): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, data, { merge: true });
  } catch (error) {
    console.error('Error saving user data to Firestore:', error);
    throw error;
  }
};

/**
 * Loads user productivity data from Firestore.
 * Path: users/{uid}
 */
export const loadUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error loading user data from Firestore:', error);
    throw error;
  }
};
