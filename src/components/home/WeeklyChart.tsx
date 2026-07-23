import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import type { DailySnapshot } from '../../services/gamification';
import { getCompletionRate } from '../../services/gamification';

type Props = {
  data: DailySnapshot[];
};

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const formatDayLabel = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return DAY_LABELS[date.getDay()];
};

export const WeeklyChart = ({ data }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const maxRate = 100;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Últimos 7 días</Text>
      <View style={styles.chart}>
        {data.map((day) => {
          const rate = getCompletionRate(day);
          const height = Math.max(8, (rate / maxRate) * 100);
          const hasActivity =
            day.goalsTotal + day.habitsTotal > 0 || day.pomodoroSessions > 0;
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
                {formatDayLabel(day.date)}
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

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: 15,
      fontWeight: '800',
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
      fontSize: 11,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      marginTop: 6,
    },
    dayLabelToday: {
      color: colors.primary,
      fontWeight: '900',
    },
    rateLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  });
