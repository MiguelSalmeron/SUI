/**
 * SuiLoader — indicador de carga indeterminado (§12, §13).
 *
 * Anillo abierto que gira mientras dura el trabajo real. Es geometría pura:
 * nunca un glifo de fuente, porque `Ionicons.ttf` se carga junto a Poppins y un
 * iconfont sería invisible justo en la pantalla que espera a las fuentes.
 *
 * Es decorativo y no se anuncia: el contenedor comunica el estado.
 * Con reducción de movimiento queda estático (§13).
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAppTheme } from '@/shared/theme/theme';
import { useReduceMotion } from './motion/useReduceMotion';

/** Tamaño de la familia "acción en curso" (§12). */
export const SUI_LOADER_SIZE = 20;

/** Porción visible del anillo; el resto es la separación. */
const ARC_SWEEP_DEGREES = 280;

export type SuiLoaderProps = {
  /** Caja del indicador en dp. Default `SUI_LOADER_SIZE`. */
  size?: number;
  strokeWidth?: number;
  /** Default `theme.colors.primary`, que ya se resuelve por esquema. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const SuiLoader = ({
  size = SUI_LOADER_SIZE,
  strokeWidth = 3,
  color,
  style,
}: SuiLoaderProps) => {
  const { colors, motion } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const rotateDuration = motion.indeterminate.rotate;

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: rotateDuration,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, rotateDuration, spin]);

  const geometry = useMemo(() => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const visible = (circumference * ARC_SWEEP_DEGREES) / 360;
    return {
      radius,
      center: size / 2,
      dash: `${visible} ${circumference - visible}`,
    };
  }, [size, strokeWidth]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[styles.box, { width: size, height: size }, { transform: [{ rotate }] }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={geometry.center}
          cy={geometry.center}
          r={geometry.radius}
          stroke={color ?? colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={geometry.dash}
          fill="none"
          rotation={-90}
          origin={`${geometry.center}, ${geometry.center}`}
        />
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
