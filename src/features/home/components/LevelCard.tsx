import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { SUI_FONTS } from '@/shared/theme/brand';
import { calculateLevel } from '@/shared/domain/productivity/gamification';

type Props = {
  totalXp: number;
};

export const LevelCard = ({ totalXp }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const level = useMemo(() => calculateLevel(totalXp), [totalXp]);
  const anim = useRef(new Animated.Value(level.progress)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: level.progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [level.progress, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelNumber}>{level.level}</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{level.title}</Text>
          <Text style={styles.subtitle}>
            {level.currentXp} / {level.nextLevelXp} XP al siguiente nivel
          </Text>
        </View>
        <Text style={styles.xpTotal}>{totalXp} XP</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.sm,
    },
    levelBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelNumber: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
      color: colors.primary,
    },
    textCol: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '400',
      fontFamily: SUI_FONTS.display,
      color: colors.onSurface,
    },
    subtitle: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: 'Poppins-SemiBold',
      color: colors.onSurfaceVariant,
      opacity: 0.8,
      marginTop: 2,
    },
    xpTotal: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
      color: colors.primary,
    },
    track: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceContainerHigh,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
