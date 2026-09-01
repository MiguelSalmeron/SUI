import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';

type Props = {
  /** Número de items completados hoy (metas + hábitos). */
  completed: number;
  /** Número total de items del día. */
  total: number;
  /** Acción opcional al pulsar (p. ej. abrir reporte). */
  label?: string;
};

/**
 * Barra de progreso diario en tiempo real. Se anima cada vez que cambia el
 * porcentaje de cumplimiento (al marcar/desmarcar una meta o hábito).
 */
export const DailyProgress = ({ completed, total, label }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const message =
    total === 0
      ? t('daily.empty')
      : percent === 100
        ? t('daily.complete')
        : t('daily.progress', { done: completed, total, label: label ?? t('daily.completed') });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('home.dailyProgress')}</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>

      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.sm,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    title: {
      ...type.titleMd,
      color: colors.onSurface,
    },
    percent: {
      ...type.titleLg,
      color: colors.primary,
    },
    track: {
      height: 12,
      borderRadius: 999,
      backgroundColor: colors.outlineVariant,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.success,
    },
    message: {
      ...type.labelMd,
      marginTop: SPACING.sm,
      color: colors.onSurfaceVariant,
    },
  });
