/**
 * Skeleton — placeholder con shimmer para estados de carga.
 *
 * Sin dependencias: usa Animated.loop con native driver.
 * Uso:
 *   <Skeleton width="100%" height={120} radius="lg" />
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import { MD3_RADIUS, useAppTheme } from '../../theme/theme';

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
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

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
    <View style={[containerStyle, style]} accessibilityElementsHidden importantForAccessibility="no">
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
