import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';

/**
 * Indicador "escribiendo…" del bot. Tres puntos con animación de opacidad.
 */
export const TypingIndicator = () => {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.avatar} />
      <View style={styles.bubble}>
        {dots.map((dot, index) => (
          <Animated.View key={index} style={[styles.dot, { opacity: dot }]} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: MD3_COLORS.primary,
    marginRight: SPACING.sm,
    opacity: 0.5,
  },
  bubble: {
    flexDirection: 'row',
    backgroundColor: MD3_COLORS.surface,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: MD3_COLORS.onSurfaceVariant,
  },
});
