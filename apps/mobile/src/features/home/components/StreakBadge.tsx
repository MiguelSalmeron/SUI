import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { AppTheme, MD3_RADIUS, SPACING, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';

type Props = {
  /** Días consecutivos cumpliendo. 0 = sin racha activa. */
  streak: number;
};

/**
 * Insignia de RACHA: número grande + indicador visual que late al subir.
 * Refuerza la constancia diaria, métrica clave del piloto SUI.
 *
 * Si la racha es 0, invita a empezar (sin culpar).
 */
export const StreakBadge = ({ streak }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const scale = useRef(new Animated.Value(1)).current;
  const active = streak > 0;

  // Late cada vez que la racha sube (feedback de recompensa).
  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: Platform.OS !== 'web', speed: 20 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web', speed: 12 }),
    ]).start();
  }, [streak, active, scale]);

  return (
    <View style={[styles.card, active ? styles.cardActive : styles.cardIdle]}>
      <Animated.View
        style={[styles.dot, active ? styles.dotActive : styles.dotIdle, { transform: [{ scale }] }]}
      >
        <Ionicons
          name={active ? 'flame' : 'flame-outline'}
          size={20}
          color={active ? colors.onFlame : colors.primary}
        />
      </Animated.View>
      <View style={styles.textCol}>
        {active ? (
          <>
            <Text style={styles.count}>
              {streak === 1 ? t('streak.oneDay') : t('streak.days', { count: streak })}
            </Text>
            <Text style={styles.label}>{t('streak.activeBody')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.countIdle}>{t('streak.emptyTitle')}</Text>
            <Text style={styles.label}>{t('streak.emptyBody')}</Text>
          </>
        )}
      </View>
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderRadius: MD3_RADIUS.xl,
      padding: SPACING.lg,
      borderWidth: 1,
      marginBottom: SPACING.sm,
    },
    cardActive: {
      backgroundColor: colors.flameContainer,
      borderColor: colors.flameOutline,
    },
    cardIdle: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
    },
    dot: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotActive: {
      backgroundColor: colors.flame,
    },
    dotIdle: {
      backgroundColor: colors.primaryContainer,
    },
    textCol: {
      flex: 1,
    },
    count: {
      ...type.headlineMd,
      color: colors.flame,
    },
    countIdle: {
      ...type.titleLg,
      color: colors.onSurface,
    },
    label: {
      ...type.labelMd,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  });
