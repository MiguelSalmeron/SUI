/**
 * LoadingScreen — pantalla de carga de arranque (familia 1, §13).
 *
 * Isologo a la geometría exacta del splash nativo (220 × 160 dp) para que el
 * fade entregue la marca ya en su lugar: una sola pantalla que cobra vida, no
 * dos encadenadas. El indicador va debajo, así el logo queda protagonista y
 * quieto y el movimiento no compite con el wordmark.
 *
 * Presentacional: el mensaje lo decide quien la usa, atado a trabajo real.
 */

import { useEffect, useMemo } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiLoader } from '@/shared/ui/SuiLoader';
import { SuiMark } from '@/shared/ui/SuiMark';

/** Alto del isologo; su ancho resulta ≈ 220 dp (maestro 1024/745). */
const LOGO_HEIGHT = 160;

/** Protección de marca: ≥ 22 % de la altura; recomendado ≈ 0,3 ×. */
const BRAND_CLEARANCE = LOGO_HEIGHT * 0.3;

type Props = {
  /** Sólo a partir de 3 s, atado a trabajo real (§13). */
  message?: string;
};

export const LoadingScreen = ({ message }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (!message) return;
    // `accessibilityLiveRegion` ya anuncia el cambio de subárbol en Android;
    // el anuncio explícito es necesario sólo en iOS, donde la prop no aplica.
    // Anunciar en ambas plataformas duplicaría la línea en TalkBack.
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility?.(message);
  }, [message]);

  return (
    <View style={styles.screen} testID="loading-screen">
      {/* `brand` en ambos esquemas: el splash nativo ya muestra el azul sobre
          `#0B132B`, así que invertirlo a blanco en oscuro rompería el relevo. */}
      <SuiMark variant="isologo" tone="brand" size={LOGO_HEIGHT} accessible />
      <View style={styles.indicator}>
        <SuiLoader />
      </View>
      {message ? (
        // La live region vive en el `Text`, no en el contenedor: Android anuncia
        // el nodo que cambió, y un `View` sin texto propio no tiene qué anunciar.
        <Text style={styles.message} accessibilityRole="text" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    indicator: {
      marginTop: BRAND_CLEARANCE,
    },
    message: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 280,
      marginTop: SPACING.md,
    },
  });
