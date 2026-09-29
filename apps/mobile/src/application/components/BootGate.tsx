/**
 * BootGate — familia 1: bloqueo de arranque (§12, §13).
 *
 * Cubre fuentes e hidratación de entrada con la marca a la vista, en lugar de
 * la pantalla vacía que había antes. Ambos gate tienen salida garantizada
 * (`useFontsReady` degrada a fuentes del sistema a los 8 s; la hidratación se
 * fuerza a los 4 s), así que la pantalla nunca dura más de 8 s y no expone un
 * estado de error propio: un fallo real lo maneja `RootErrorBoundary`.
 *
 * El splash nativo se retira en cuanto esta pantalla tiene su primer layout,
 * para que el fade de 350 ms entregue el isologo ya en su lugar.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useIntroStore } from '@/features/onboarding/public';
import { useI18n } from '@/shared/i18n/i18n';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { LoadingScreen } from './LoadingScreen';
import { useFontsReady } from './useFontsReady';

/** Salida garantizada si el Guardián de Estado no rehidrata. */
const HYDRATION_TIMEOUT_MS = 4000;

/** Silencio inicial; después, una línea que describe el estado (§13). */
export const MESSAGE_DELAY_MS = 3000;

type Props = {
  children: ReactNode;
  /** Ajustable para pruebas con reloj real. */
  messageDelayMs?: number;
};

export const BootGate = ({ children, messageDelayMs = MESSAGE_DELAY_MS }: Props) => {
  const { ready: fontsReady, status: fontsStatus } = useFontsReady();
  const hydrated = useIntroStore((state) => state.hydrated);
  const setHydrated = useIntroStore((state) => state.setHydrated);
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  const splashHidden = useRef(false);
  const ready = fontsReady && hydrated;

  useEffect(() => {
    if (hydrated) return;
    const timer = setTimeout(() => setHydrated(true), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hydrated, setHydrated]);

  useEffect(() => {
    if (ready) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), messageDelayMs);
    return () => clearTimeout(timer);
  }, [messageDelayMs, ready]);

  useEffect(() => {
    if (fontsReady) recordTelemetry('app.start', { fonts: fontsStatus });
  }, [fontsReady, fontsStatus]);

  const handleFirstLayout = useCallback(() => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  return (
    <View style={styles.root} onLayout={handleFirstLayout} testID="boot-gate">
      {ready ? children : <LoadingScreen message={slow ? t('loading.preparing') : undefined} />}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
});
