import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfigKeys.length > 0) {
  console.warn(
    `Firebase config is incomplete. Missing: ${missingConfigKeys.join(', ')}. Set the EXPO_PUBLIC_FIREBASE_* environment variables with the values from your Firebase web app configuration.`
  );
}

// Initialize Firebase
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Persist the auth session to AsyncStorage so the anonymous user survives
// app restarts. initializeAuth throws if auth was already initialized on this
// app (happens on Fast Refresh), so fall back to the existing instance.
export const auth = (() => {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(firebaseApp);
  }
})();
export const db = getFirestore(firebaseApp);

const appCheckSiteKey = process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY?.trim() ?? '';

export const appCheck: AppCheck | null = (() => {
  if (Platform.OS !== 'web' || !appCheckSiteKey) return null;
  try {
    return initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    return null;
  }
})();

export const getAppCheckToken = async (): Promise<string> => {
  if (!appCheck) return '';
  try {
    return (await getToken(appCheck)).token;
  } catch {
    return '';
  }
};
