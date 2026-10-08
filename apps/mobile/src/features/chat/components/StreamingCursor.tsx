import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Platform, StyleSheet } from 'react-native';
import { type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';

export const StreamingCursor = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const reduceMotion = useReduceMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (reduceMotion !== false || !foreground) return;
    const timing = (toValue: number) =>
      Animated.timing(opacity, {
        toValue,
        duration: 600,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    const loop = Animated.loop(Animated.sequence([timing(0.25), timing(1)]));
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [foreground, reduceMotion, opacity]);
  return (
    <Animated.View
      testID="streaming-cursor"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cursor, { opacity }]}
    />
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    cursor: { width: 2, height: type.bodyLg.lineHeight, backgroundColor: colors.secondary },
  });
