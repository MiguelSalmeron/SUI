import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { calculateLevel } from '@/shared/domain/productivity/gamification';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';

type Props = {
  totalXp: number;
};

export const LevelCard = ({ totalXp }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
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
          <Text style={styles.title}>{t(`progress.level${Math.min(level.level, 7)}` as TranslationKey)}</Text>
          <Text style={styles.subtitle}>
            {t('progress.levelNext', { current: level.currentXp, total: level.nextLevelXp })}
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

const createStyles = ({ colors, type }: AppTheme) =>
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
      ...type.titleLg,
      color: colors.primary,
    },
    textCol: {
      flex: 1,
    },
    title: {
      ...type.brandTitle,
      color: colors.onSurface,
    },
    subtitle: {
      ...type.labelMd,
      color: colors.onSurfaceVariant,
      opacity: 0.8,
      marginTop: 2,
    },
    xpTotal: {
      ...type.labelLg,
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
