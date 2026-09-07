import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/shared/theme/theme';
import { MOTION } from '@/shared/ui/motion/motionTokens';

interface OnboardingPaginatorProps {
  total: number;
  activeIndex: number;
}

export const OnboardingPaginator = ({ total, activeIndex }: OnboardingPaginatorProps) => {
  const theme = useAppTheme();

  return (
    <View style={styles.container} accessibilityRole="adjustable" accessibilityLabel={`Paso ${activeIndex + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Pill key={i} active={i === activeIndex} theme={theme} />
      ))}
    </View>
  );
};

const Pill = ({ active, theme }: { active: boolean; theme: ReturnType<typeof useAppTheme> }) => {
  const animWidth = useRef(new Animated.Value(active ? 24 : 8)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: active ? 24 : 8,
      duration: MOTION.durations.quick,
      easing: MOTION.easings.standard,
      useNativeDriver: false, // width animation requires false in react-native
    }).start();
  }, [active, animWidth]);

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          width: animWidth,
          backgroundColor: active ? theme.colors.primary : theme.colors.outlineVariant,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 16,
  },
  pill: {
    height: 8,
    borderRadius: 4,
  },
});
