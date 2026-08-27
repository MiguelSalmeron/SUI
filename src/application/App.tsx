import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { useOnboardingStore } from '@/features/onboarding/store/useOnboardingStore';
import { signInAnon } from '@/features/auth/services/onboardingAuth';
import { configureNotificationHandler } from '@/features/settings/services/notifications';
import { ThemeProvider, useAppTheme } from '@/shared/theme/theme';
import { AppNavigator } from './navigation/AppNavigator';

/**
 * PWA: html/body/#root default white → raya blanca bajo UI dark.
 * Sincroniza chrome del browser con el theme activo.
 */
const useSyncWebChrome = (background: string) => {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById('root');

    root.style.backgroundColor = background;
    root.style.minHeight = '100%';
    body.style.backgroundColor = background;
    body.style.minHeight = '100dvh';
    if (appRoot) {
      appRoot.style.backgroundColor = background;
      appRoot.style.minHeight = '100dvh';
    }

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', background);

    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute('content') ?? '';
      if (!content.includes('viewport-fit=cover')) {
        viewport.setAttribute(
          'content',
          `${content.replace(/,\s*$/, '')}, viewport-fit=cover`,
        );
      }
    }
  }, [background]);
};

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

  // Preload desde assets/ (no node_modules). En PWA, Firebase ignoraba
  // **/node_modules/** → .ttf 404 → rewrite devolvía index.html → OTS fail
  // → @expo/vector-icons deja <Text /> vacío (badge sí, icono no).
  const [fontsLoaded, fontError] = useFonts({
    ionicons: require('../../assets/fonts/Ionicons.ttf'),
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
    'FredokaOne-Regular': require('../../assets/fonts/FredokaOne-Regular.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
  useSyncWebChrome(theme.colors.background);

  return (
    <>
      <AppNavigator />
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
};
