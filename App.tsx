import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useOnboardingStore } from './src/store/useOnboardingStore';
import { signInAnon } from './src/services/onboardingAuth';
import { configureNotificationHandler } from './src/services/notifications';
import { ThemeProvider, useAppTheme } from './src/theme/theme';

// Mantener el splash nativo visible hasta que la app esté lista. Se llama en
// scope global (sin await) según recomendación oficial de expo-splash-screen:
// dentro de un componente/hook podría ejecutarse demasiado tarde.
SplashScreen.preventAutoHideAsync();

// Animación de salida del splash (fade suave en iOS, duración en Android).
SplashScreen.setOptions({ duration: 350, fade: true });

// Registro global del handler de notificaciones (una sola vez, fuera del árbol
// de React para que aplique también a notificaciones recibidas en background).
configureNotificationHandler();

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
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const AppShell = () => {
  const theme = useAppTheme();

  return (
    <>
      <AppNavigator />
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
};
