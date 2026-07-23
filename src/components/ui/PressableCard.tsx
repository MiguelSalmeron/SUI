/**
 * PressableCard — Pressable con state-layer MD3 aplicado.
 *
 * Reemplaza TouchableOpacity en superficies interactivas. Aplica overlay
 * semántico (hover/pressed) según MD3_STATE_LAYER sin hardcodear opacidad.
 *
 * Uso:
 *   <PressableCard onPress={...} level="level1" style={...}>
 *     {children}
 *   </PressableCard>
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  AppTheme,
  ColorScheme,
  MD3_RADIUS,
  SurfaceLevel,
  createSurface,
  useAppTheme,
} from '../../theme/theme';

export type PressableCardProps = {
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  level?: SurfaceLevel;
  radius?: keyof typeof MD3_RADIUS;
  /** Anula el color de fondo base (para botones primary/secondary). */
  backgroundColor?: string;
  /** Anula el color del state layer (por defecto onSurface). */
  stateLayerColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  children?: React.ReactNode;
};

const computeOverlay = (
  scheme: ColorScheme,
  baseColor: string,
  pressed: boolean,
  hovered: boolean,
  theme: AppTheme,
): string => {
  if (pressed) {
    return withAlpha(baseColor, theme.stateLayer.pressed, scheme);
  }
  if (hovered) {
    return withAlpha(baseColor, theme.stateLayer.hover, scheme);
  }
  return 'transparent';
};

/**
 * Mezcla `color` con alpha `a` sobre el fondo surface del scheme. Implementación
 * hex-only para evitar dependencias (los tokens del theme ya son hex).
 */
const withAlpha = (hex: string, alpha: number, _scheme: ColorScheme): string => {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return 'transparent';
  }
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${full}${a}`;
};

export const PressableCard: React.FC<PressableCardProps> = ({
  onPress,
  onLongPress,
  disabled = false,
  level = 'level1',
  radius = 'lg',
  backgroundColor,
  stateLayerColor,
  style,
  contentStyle,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  testID,
  children,
}) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const surface = useMemo(() => createSurface(theme, level), [theme, level]);
  const baseColor = backgroundColor ?? surface.backgroundColor;
  const overlayColor = useMemo(
    () =>
      computeOverlay(
        colors,
        stateLayerColor ?? colors.onSurface,
        pressed,
        hovered,
        theme,
      ),
    [colors, stateLayerColor, pressed, hovered, theme],
  );

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  const radiusValue = MD3_RADIUS[radius];

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      disabled={disabled || (!onPress && !onLongPress)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || (!onPress && !onLongPress) }}
      testID={testID}
      style={[
        styles.base,
        {
          backgroundColor: baseColor,
          borderRadius: radiusValue,
          borderColor: surface.borderColor,
          borderWidth: surface.borderWidth,
          shadowColor: surface.shadowColor,
          shadowOffset: surface.shadowOffset,
          shadowOpacity: surface.shadowOpacity,
          shadowRadius: surface.shadowRadius,
          elevation: surface.elevation,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: overlayColor,
            borderRadius: radiusValue,
          },
        ]}
      />
      <View style={contentStyle}>{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
