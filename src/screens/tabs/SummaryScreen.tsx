import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { useHomeStore } from '../../store/useHomeStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { WeeklyChart } from '../../components/home/WeeklyChart';
import { AchievementGrid } from '../../components/home/AchievementGrid';
import { LevelCard } from '../../components/home/LevelCard';
import {
  buildWeeklyView,
  getAchievements,
  getWeeklyInsight,
} from '../../services/gamification';

export const SummaryScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const totalXp = useHomeStore((s) => s.totalXp);
  const weeklyHistory = useHomeStore((s) => s.weeklyHistory);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);
  const pomodoroMinutes = usePomodoroStore((s) => s.pomodoroMinutes);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);

  const week = useMemo(() => buildWeeklyView(weeklyHistory), [weeklyHistory]);

  const weekTotals = useMemo(() => {
    const goalsDone = week.reduce((s, d) => s + d.goalsCompleted, 0);
    const habitsDone = week.reduce((s, d) => s + d.habitsCompleted, 0);
    const pomodoros = week.reduce((s, d) => s + d.pomodoroSessions, 0);
    const focusMin = week.reduce((s, d) => s + d.pomodoroMinutes, 0);
    const activeDays = week.filter(
      (d) => d.goalsCompleted + d.habitsCompleted > 0 || d.pomodoroSessions > 0,
    ).length;
    return { goalsDone, habitsDone, pomodoros, focusMin, activeDays };
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
        pomodoroSessions,
        weeklyHistory,
      }),
    [completedGoals, goals.length, completedHabits, habits.length, streak, pomodoroSessions, weeklyHistory],
  );

  const insight = useMemo(() => getWeeklyInsight(week, streak), [week, streak]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tu progreso</Text>
        <Text style={styles.sectionSubtitle}>Datos de los últimos 7 días</Text>
      </View>

      <LevelCard totalXp={totalXp} />

      <View style={styles.insightCard}>
        <Ionicons name="bulb" size={20} color={colors.onSecondary} />
        <Text style={styles.insightText}>{insight}</Text>
      </View>

      <WeeklyChart data={week} />

      <View style={styles.statsGrid}>
        <StatBox
          icon="flag"
          label="Metas"
          value={String(weekTotals.goalsDone)}
          colors={colors}
        />
        <StatBox
          icon="repeat"
          label="Hábitos"
          value={String(weekTotals.habitsDone)}
          colors={colors}
        />
        <StatBox
          icon="timer"
          label="Pomodoros"
          value={String(weekTotals.pomodoros)}
          colors={colors}
        />
        <StatBox
          icon="calendar"
          label="Días activos"
          value={`${weekTotals.activeDays}/7`}
          colors={colors}
        />
      </View>

      <View style={styles.todayCard}>
        <Text style={styles.todayTitle}>Hoy</Text>
        <View style={styles.todayRow}>
          <Text style={styles.todayStat}>
            {completedGoals}/{goals.length} metas · {completedHabits}/{habits.length} hábitos
          </Text>
          <Text style={styles.todayRate}>{todayRate}%</Text>
        </View>
        <Text style={styles.todayHint}>
          {pomodoroSessions} pomodoros · {pomodoroMinutes} min de enfoque
        </Text>
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
};

const StatBox = ({ icon, label, value, colors }: StatBoxProps) => (
  <View style={[statStyles.box, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <Text style={[statStyles.value, { color: colors.onSurface }]}>{value}</Text>
    <Text style={[statStyles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  box: {
    width: '47%',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl + 72,
    },
    sectionHeader: {
      marginBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
    },
    sectionSubtitle: {
      marginTop: 4,
      color: colors.onSurfaceVariant,
      fontSize: 14,
      fontWeight: '600',
    },
    insightCard: {
      backgroundColor: colors.secondary,
      borderRadius: 16,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    insightText: {
      flex: 1,
      color: colors.onSecondary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    todayCard: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    todayTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.onPrimary,
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
      fontSize: 15,
      fontWeight: '700',
      color: colors.onPrimary,
      flex: 1,
    },
    todayRate: {
      fontSize: 28,
      fontWeight: '900',
      color: colors.onPrimary,
    },
    todayHint: {
      fontSize: 13,
      color: colors.onPrimary,
      opacity: 0.85,
      marginTop: 6,
      fontWeight: '600',
    },
  });
