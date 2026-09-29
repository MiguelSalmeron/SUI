/**
 * Skeleton — placeholder con shimmer para estados de carga.
 *
 * Sin dependencias: usa Animated.loop con native driver. Con reducción de
 * movimiento (§15) queda estático; el indicador no anima a ciegas.
 * Uso:
 *   <Skeleton width="100%" height={120} radius="lg" />
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, DimensionValue, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { MD3_RADIUS, useAppTheme } from '@/shared/theme/theme';
import { useReduceMotion } from './motion/useReduceMotion';

/** Opacidad base del brillo; con reducción de movimiento el indicador queda acá. */
const BASE_OPACITY = 0.55;
const PEAK_OPACITY = 1;

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: keyof typeof MD3_RADIUS;
  style?: ViewStyle;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 64,
  radius = 'md',
  style,
}) => {
  const { colors, motion } = useAppTheme();
  const shimmer = motion.indeterminate.shimmer;
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(BASE_OPACITY)).current;

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      opacity.setValue(BASE_OPACITY);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PEAK_OPACITY,
          duration: shimmer,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: BASE_OPACITY,
          duration: shimmer,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, shimmer, reduceMotion]);

  const containerStyle = useMemo<ViewStyle>(
    () => ({
      width,
      height,
      borderRadius: MD3_RADIUS[radius],
      backgroundColor: colors.surfaceContainerHigh,
      overflow: 'hidden',
    }),
    [width, height, radius, colors.surfaceContainerHigh],
  );

  return (
    <View
      style={[containerStyle, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.surfaceContainerHighest,
            opacity,
          },
        ]}
      />
    </View>
  );
};
