import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Preferencia de reducción de movimiento (§13, §15), compartida por los
 * indicadores indeterminados (`SuiLoader`, `Skeleton`).
 *
 * `null` mientras la preferencia es desconocida: ningún indicador debe animar
 * a ciegas ni quedarse quieto por una consulta que la plataforma no expone. Si
 * la API no existe (p. ej. web), degrada a `false` y se anima igual.
 */
export const useReduceMotion = (): boolean | null => {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const enabled = AccessibilityInfo.isReduceMotionEnabled?.();
    if (!enabled) {
      setReduceMotion(false);
      return;
    }
    void enabled
      .then((value) => {
        if (active) setReduceMotion(Boolean(value));
      })
      .catch(() => {
        if (active) setReduceMotion(false);
      });
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
      if (active) setReduceMotion(Boolean(value));
    });
    return () => {
      active = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
};
