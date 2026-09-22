import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, signInAnon } from '@/features/auth/public';
import { useIntroStore } from '@/features/onboarding/public';
import { configureNotificationHandler, reconcileNightlyReport } from '@/features/settings/public';
import { ThemeProvider, useAppTheme } from '@/shared/theme/theme';
import { AppNavigator } from './navigation/AppNavigator';
import { recordTelemetry, wrapApplication } from '@/shared/observability/telemetry';
import { useProductivityEventEffects } from '@/shared/events/useProductivityEventEffects';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { useFontsReady } from './components/useFontsReady';

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
        viewport.setAttribute('content', `${content.replace(/,\s*$/, '')}, viewport-fit=cover`);
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
  const hydrated = useIntroStore((state) => state.hydrated);
  const introComplete = useIntroStore((state) => state.introComplete);
  const accountMode = useIntroStore((state) => state.accountMode);
  const syncPending = useIntroStore((state) => state.technicalAuthPending);
  const setTechnicalAuthPending = useIntroStore((state) => state.setTechnicalAuthPending);

  useEffect(() => {
    if (!hydrated || !introComplete || accountMode !== 'local') return;
    let active = true;
    (async () => {
      const result = await signInAnon();
      if (!active) return;
      setTechnicalAuthPending(result.syncPending);
    })();
    return () => {
      active = false;
    };
  }, [accountMode, hydrated, introComplete, syncPending, setTechnicalAuthPending]);
};

const useReconcileNotifications = () => {
  useEffect(() => {
    const reconcile = () => void reconcileNightlyReport();
    if (useSettingsStore.persist.hasHydrated()) {
      reconcile();
      return;
    }
    return useSettingsStore.persist.onFinishHydration(reconcile);
  }, []);
};

function App() {
  const [boundaryKey, setBoundaryKey] = useState(0);

  return (
    <RootErrorBoundary
      key={boundaryKey}
      onRetry={() => setBoundaryKey((value) => value + 1)}
    >
      <Boot />
    </RootErrorBoundary>
  );
}

function Boot() {
  useRetryPendingAuth();
  useProductivityEventEffects();
  useReconcileNotifications();

  const { ready, status } = useFontsReady();

  useEffect(() => {
    if (ready) {
      recordTelemetry('app.start', { fonts: status });
    }
  }, [ready, status]);

  if (!ready) {
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

export default wrapApplication(App);

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
