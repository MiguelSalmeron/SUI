import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';

export const FONTS_TIMEOUT_MS = 8000;

export type FontsStatus = 'loading' | 'loaded' | 'error' | 'timeout';

/**
 * Fuentes con degradado: si fallan o tardan más del timeout, la app
 * abre igual con fuentes del sistema en vez de quedarse en splash
 * para siempre (hideAsync vive bajo este gate).
 */
export const useFontsReady = () => {
  // Preload desde assets/ (no node_modules). En PWA, Firebase ignoraba
  // **/node_modules/** → .ttf 404 → rewrite devolvía index.html → OTS fail
  // → @expo/vector-icons deja <Text /> vacío (badge sí, icono no).
  const [fontsLoaded, fontError] = useFonts({
    ionicons: require('../../../assets/fonts/Ionicons.ttf'),
    'Poppins-Regular': require('../../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../../assets/fonts/Poppins-Bold.ttf'),
    'FredokaOne-Regular': require('../../../assets/fonts/FredokaOne-Regular.ttf'),
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setTimedOut(true), FONTS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const status: FontsStatus = fontsLoaded
    ? 'loaded'
    : fontError
      ? 'error'
      : timedOut
        ? 'timeout'
        : 'loading';

  return { ready: status !== 'loading', status };
};
