import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useOnboardingStore } from './src/store/useOnboardingStore';
import { signInAnon } from './src/services/onboardingAuth';

/**
 * Reintenta el alta anónima si una sesión previa quedó pendiente de
 * sincronizar (Fase 4: "Falla de Firebase Auth Offline"). Se ejecuta una vez
 * que el Guardián de Estado terminó de rehidratar.
 */
const useRetryPendingAuth = () => {
  const hydrated = useOnboardingStore((state) => state.hydrated);
  const syncPending = useOnboardingStore((state) => state.syncPending);

  useEffect(() => {
    if (!hydrated || !syncPending) return;
    let active = true;
    (async () => {
      const result = await signInAnon();
      if (!active || result.syncPending) return;
      useOnboardingStore.setState({ anonUid: result.uid, syncPending: false });
    })();
    return () => {
      active = false;
    };
  }, [hydrated, syncPending]);
};

export default function App() {
  useRetryPendingAuth();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
