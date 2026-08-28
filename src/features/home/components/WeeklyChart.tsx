import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import type { DailySnapshot } from '@/shared/domain/productivity/gamification';
import { getCompletionRate } from '@/shared/domain/productivity/gamification';
import { useI18n } from '@/shared/i18n/i18n';

type Props = {
  data: DailySnapshot[];
};

const formatDayLabel = (dateKey: string, locale: 'es' | 'en'): string => {
  const labels = locale === 'es' ? ['D', 'L', 'M', 'X', 'J', 'V', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return labels[date.getDay()];
};

export const WeeklyChart = ({ data }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { locale, t } = useI18n();
  const maxRate = 100;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('progress.lastSevenDays')}</Text>
      <View style={styles.chart}>
        {data.map((day) => {
          const rate = getCompletionRate(day);
          const height = Math.max(8, (rate / maxRate) * 100);
          const hasActivity = day.goalsTotal + day.habitsTotal > 0;
          const isToday = day.date === data[data.length - 1]?.date;

          return (
            <View key={day.date} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${hasActivity ? height : 8}%`,
                      backgroundColor: hasActivity
                        ? rate >= 80
                          ? colors.success
                          : rate >= 50
                          ? colors.primary
                          : colors.secondary
                        : colors.outlineVariant,
                      opacity: isToday ? 1 : 0.75,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {formatDayLabel(day.date, locale)}
              </Text>
              {hasActivity && (
                <Text style={styles.rateLabel}>{rate}%</Text>
              )}
            </View>
          );
        })}
      </View>
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
      marginBottom: SPACING.md,
    },
    title: {
      ...type.titleMd,
      color: colors.onSurface,
      marginBottom: SPACING.md,
    },
    chart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: SPACING.xs,
      height: 140,
    },
    barCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    barTrack: {
      width: '100%',
      height: 100,
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    barFill: {
      width: '70%',
      borderRadius: 8,
      minHeight: 8,
    },
    dayLabel: {
      ...type.labelSm,
      color: colors.onSurfaceVariant,
      marginTop: 6,
    },
    dayLabelToday: {
      color: colors.primary,
      fontFamily: type.titleSm.fontFamily,
      fontWeight: type.titleSm.fontWeight,
    },
    rateLabel: {
      ...type.labelXs,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  });
