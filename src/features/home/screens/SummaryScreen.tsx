import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AppTheme,
  ColorScheme,
  SCREEN_CONTENT_BOTTOM_PADDING,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import { ScreenIntro } from '@/shared/ui/ScreenIntro';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { WeeklyChart } from '../components/WeeklyChart';
import { AchievementGrid } from '../components/AchievementGrid';
import { LevelCard } from '../components/LevelCard';
import {
  buildWeeklyView,
  getAchievements,
  getWeeklyInsight,
} from '@/shared/domain/productivity/gamification';
import { useI18n } from '@/shared/i18n/i18n';

export const SummaryScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const statBoxStyles = useMemo(() => createStatStyles(theme), [theme]);
  const { t } = useI18n();

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const totalXp = useHomeStore((s) => s.totalXp);
  const weeklyHistory = useHomeStore((s) => s.weeklyHistory);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);

  const week = useMemo(() => buildWeeklyView(weeklyHistory), [weeklyHistory]);

  const weekTotals = useMemo(() => {
    const goalsDone = week.reduce((s, d) => s + d.goalsCompleted, 0);
    const habitsDone = week.reduce((s, d) => s + d.habitsCompleted, 0);
    const activeDays = week.filter(
      (d) => d.goalsCompleted + d.habitsCompleted > 0,
    ).length;
    return { goalsDone, habitsDone, activeDays };
  }, [week]);

  const todayRate = useMemo(() => {
    const total = goals.length + habits.length;
    if (total === 0) return 0;
    return Math.round(((completedGoals + completedHabits) / total) * 100);
  }, [goals.length, habits.length, completedGoals, completedHabits]);

  const achievements = useMemo(
    () =>
      getAchievements({
        goalsCompleted: completedGoals,
        goalsTotal: goals.length,
        habitsCompleted: completedHabits,
        habitsTotal: habits.length,
        streak,
        weeklyHistory,
      }),
    [completedGoals, goals.length, completedHabits, habits.length, streak, weeklyHistory],
  );

  const insightData = useMemo(() => getWeeklyInsight(week, streak), [week, streak]);
  const insight = insightData.kind === 'empty'
    ? t('progress.insightEmpty')
    : insightData.kind === 'excellent'
      ? t('progress.insightExcellent', { rate: insightData.rate, streak: insightData.streak })
      : insightData.kind === 'active'
        ? t('progress.insightActive', { days: insightData.days })
        : t('progress.insightAverage', { rate: insightData.rate });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenIntro
        title={t('progress.title')}
        subtitle={t('progress.subtitle')}
      />

      <LevelCard totalXp={totalXp} />

      <View style={styles.insightCard}>
        <View style={styles.insightIcon}>
          <Ionicons name="bulb-outline" size={19} color={colors.flame} />
        </View>
        <Text style={styles.insightText}>{insight}</Text>
      </View>

      <WeeklyChart data={week} />

      <View style={styles.statsGrid}>
        <StatBox
          icon="flag"
          label={t('progress.goals')}
          value={String(weekTotals.goalsDone)}
          colors={colors}
          styles={statBoxStyles}
        />
        <StatBox
          icon="repeat"
          label={t('progress.habits')}
          value={String(weekTotals.habitsDone)}
          colors={colors}
          styles={statBoxStyles}
        />
        <StatBox
          icon="flame"
          label={t('progress.streak')}
          value={t('progress.days', { count: streak })}
          colors={colors}
          styles={statBoxStyles}
        />
        <StatBox
          icon="calendar"
          label={t('progress.activeDays')}
          value={`${weekTotals.activeDays}/7`}
          colors={colors}
          styles={statBoxStyles}
        />
      </View>

      <View style={styles.todayCard}>
        <Text style={styles.todayTitle}>{t('progress.today')}</Text>
        <View style={styles.todayRow}>
          <Text style={styles.todayStat}>
            {t('progress.todaySummary', { goalsDone: completedGoals, goalsTotal: goals.length, habitsDone: completedHabits, habitsTotal: habits.length })}
          </Text>
          <Text style={styles.todayRate}>{todayRate}%</Text>
        </View>
      </View>

      <AchievementGrid achievements={achievements} />
    </ScrollView>
  );
};

type StatBoxProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ColorScheme;
  styles: ReturnType<typeof createStatStyles>;
};

const StatBox = ({ icon, label, value, colors, styles }: StatBoxProps) => (
  <View style={[styles.box, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <Text style={[styles.value, { color: colors.onSurface }]}>{value}</Text>
    <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
  </View>
);

const createStatStyles = ({ type }: AppTheme) => StyleSheet.create({
  box: {
    width: '47%',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    ...type.headlineSm,
  },
  label: {
    ...type.labelSm,
    textTransform: 'uppercase',
  },
});

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING,
    },
    insightCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    insightIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.flameContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    insightText: {
      ...type.bodyMd,
      flex: 1,
      color: colors.onSurface,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    todayCard: {
      backgroundColor: colors.primaryContainer,
      borderRadius: 16,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    todayTitle: {
      ...type.labelMd,
      color: colors.onPrimaryContainer,
      textTransform: 'uppercase',
      opacity: 0.85,
    },
    todayRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    todayStat: {
      ...type.titleMd,
      color: colors.onPrimaryContainer,
      flex: 1,
    },
    todayRate: {
      ...type.headlineLg,
      color: colors.primary,
    },
  });
