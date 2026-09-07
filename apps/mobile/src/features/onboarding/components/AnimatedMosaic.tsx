import { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SUI_BRAND } from '@/shared/theme/brand';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { MOTION } from '@/shared/ui/motion/motionTokens';

interface AnimatedMosaicProps {
  compact?: boolean;
}

export const AnimatedMosaic = ({ compact = false }: AnimatedMosaicProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const { colors } = theme;

  const col1Anim = useRef(new Animated.Value(0)).current;
  const col2Anim = useRef(new Animated.Value(0)).current;
  const col3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        col1Anim.setValue(1);
        col2Anim.setValue(1);
        col3Anim.setValue(1);
        return;
      }

      Animated.stagger(90, [
        Animated.timing(col1Anim, {
          toValue: 1,
          duration: MOTION.durations.smooth,
          easing: MOTION.easings.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(col2Anim, {
          toValue: 1,
          duration: MOTION.durations.smooth,
          easing: MOTION.easings.decelerate,
          useNativeDriver: true,
        }),
        Animated.timing(col3Anim, {
          toValue: 1,
          duration: MOTION.durations.smooth,
          easing: MOTION.easings.decelerate,
          useNativeDriver: true,
        }),
      ]).start();
    }).catch(() => {
      col1Anim.setValue(1);
      col2Anim.setValue(1);
      col3Anim.setValue(1);
    });
  }, [col1Anim, col2Anim, col3Anim]);

  const makeColStyle = (anim: Animated.Value, distance: number) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });

  return (
    <View
      style={styles.mosaic}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.mosaicColumn, makeColStyle(col1Anim, 18)]}>
        <View style={[styles.tile, styles.tileTall, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="sprout" size={58} color={colors.primary} />
          <View style={styles.miniLines}>
            <View style={[styles.miniLine, { backgroundColor: colors.primary }]} />
            <View style={[styles.miniLineShort, { backgroundColor: colors.primary }]} />
          </View>
        </View>
        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.flameContainer }]}>
          <Ionicons name="flame" size={29} color={colors.flame} />
          <View style={styles.rhythmDots}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={[styles.rhythmDot, { backgroundColor: colors.flame }]} />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.mosaicColumn, styles.middleColumn, makeColStyle(col2Anim, 24)]}
      >
        <View
          style={[styles.tile, styles.tileShort, { backgroundColor: colors.secondaryContainer }]}
        >
          <SuiDoodle variant="path" size={52} color={colors.secondary} />
        </View>
        <View
          style={[styles.tile, styles.tileTall, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <Ionicons name="calendar-outline" size={30} color={colors.primary} />
          <View style={styles.calendarGrid}>
            {Array.from({ length: 12 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDot,
                  { backgroundColor: index === 7 ? colors.flame : colors.outlineVariant },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.mosaicColumn, makeColStyle(col3Anim, 20)]}>
        <View style={[styles.tile, styles.tileTall, { backgroundColor: SUI_BRAND.navy }]}>
          <Ionicons name="flag-outline" size={30} color={SUI_BRAND.blue} />
          <View style={[styles.progressRing, { borderColor: SUI_BRAND.blue }]} />
        </View>
        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="rhythm" size={48} color={colors.primary} />
        </View>
      </Animated.View>

      <View style={[styles.mosaicFade, { backgroundColor: colors.background }]} />
    </View>
  );
};

const createStyles = (theme: AppTheme, compact: boolean) =>
  StyleSheet.create({
    mosaic: {
      flexDirection: 'row',
      height: compact ? 150 : 184,
      gap: SPACING.xs,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: SPACING.md,
    },
    mosaicColumn: {
      flex: 1,
      gap: SPACING.xs,
    },
    middleColumn: {
      paddingTop: SPACING.sm,
    },
    tile: {
      borderRadius: theme.radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tileTall: {
      flex: 1.5,
    },
    tileShort: {
      flex: 1,
    },
    miniLines: {
      gap: 4,
      width: '60%',
      marginTop: 8,
      alignItems: 'center',
    },
    miniLine: {
      height: 3,
      width: '80%',
      borderRadius: 2,
      opacity: 0.7,
    },
    miniLineShort: {
      height: 3,
      width: '45%',
      borderRadius: 2,
      opacity: 0.5,
    },
    rhythmDots: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 6,
    },
    rhythmDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      opacity: 0.6,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 48,
      gap: 4,
      marginTop: 8,
      justifyContent: 'center',
    },
    calendarDot: {
      width: 6,
      height: 6,
      borderRadius: 2,
    },
    progressRing: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderTopColor: 'transparent',
      marginTop: 8,
      opacity: 0.8,
    },
    mosaicFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 48,
      opacity: 0.9,
    },
  });
