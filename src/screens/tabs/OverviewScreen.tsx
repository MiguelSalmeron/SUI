import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { DailyProgress } from '../../components/home/DailyProgress';
import { StreakBadge } from '../../components/home/StreakBadge';
import { LevelCard } from '../../components/home/LevelCard';
import { AchievementGrid } from '../../components/home/AchievementGrid';
import { NightlyReportModal } from '../../components/home/NightlyReportModal';
import { useHomeStore } from '../../store/useHomeStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { scheduleNightlyReport, isNightlyReportResponse } from '../../services/notifications';
import { getAchievements } from '../../services/gamification';
import type { DayStats } from '../../services/reportPrompt';

type MetricCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
  variant: 'primary' | 'secondary' | 'surface';
  colors: ColorScheme;
  onPress?: () => void;
};

const MetricCard = ({ icon, label, value, hint, variant, colors, onPress }: MetricCardProps) => {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.secondary
      : colors.surface;
  const textColor = variant === 'surface' ? colors.onSurface : colors.surface;
  const hintColor = variant === 'surface' ? colors.onSurfaceVariant : colors.surface;

  return (
    <TouchableOpacity
      style={[metricStyles.card, { backgroundColor: bg, borderColor: variant === 'surface' ? colors.outlineVariant : bg }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.85 : 1}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Ionicons name={icon} size={22} color={textColor} style={{ opacity: 0.9 }} />
      <Text style={[metricStyles.label, { color: textColor }]}>{label}</Text>
      <Text style={[metricStyles.value, { color: textColor }]}>{value}</Text>
      <Text style={[metricStyles.hint, { color: hintColor, opacity: variant === 'surface' ? 1 : 0.85 }]}>{hint}</Text>
    </TouchableOpacity>
  );
};

const metricStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    minHeight: 110,
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
});

export const OverviewScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const totalXp = useHomeStore((s) => s.totalXp);
  const weeklyHistory = useHomeStore((s) => s.weeklyHistory);
  const pomodoroMinutes = usePomodoroStore((s) => s.pomodoroMinutes);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);

  const navigation = useNavigation<any>();
  const [reportVisible, setReportVisible] = useState(false);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const dailyTotal = goals.length + habits.length;
  const dailyCompleted = completedGoals + completedHabits;

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

  const dayStats = useMemo<DayStats>(() => {
    const all = [...goals, ...habits];
    return {
      completed: all.filter((i) => i.completed).map((i) => i.title),
      pending: all.filter((i) => !i.completed).map((i) => i.title),
      streak,
    };
  }, [goals, habits, streak]);

  useEffect(() => {
    scheduleNightlyReport().catch(() => undefined);
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (isNightlyReportResponse(response)) setReportVisible(true);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isNightlyReportResponse(response)) setReportVisible(true);
    });
    return () => sub.remove();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LevelCard totalXp={totalXp} />
      <StreakBadge streak={streak} />
      <DailyProgress completed={dailyCompleted} total={dailyTotal} label="completados" />

      <View style={styles.metricRow}>
        <MetricCard
          icon="flag"
          label="Metas"
          value={String(goals.length - completedGoals)}
          hint={`${completedGoals} hechas`}
          variant="primary"
          colors={colors}
          onPress={() => navigation.navigate('Goals')}
        />
        <MetricCard
          icon="repeat"
          label="Hábitos"
          value={String(habits.length - completedHabits)}
          hint={`${completedHabits} hechos`}
          variant="secondary"
          colors={colors}
          onPress={() => navigation.navigate('Habits')}
        />
      </View>

      <MetricCard
        icon="timer"
        label="Pomodoro hoy"
        value={`${pomodoroMinutes} min`}
        hint={`${pomodoroSessions} sesiones`}
        variant="surface"
        colors={colors}
        onPress={() => navigation.navigate('Pomodoro')}
      />

      <AchievementGrid achievements={achievements} compact />

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionPrimary}
          onPress={() => navigation.navigate('Chat')}
          accessibilityRole="button"
          accessibilityLabel="Hablar con SUI"
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.surface} />
          <Text style={styles.quickActionTextLight}>Apoyo emocional</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionSecondary}
          onPress={() => navigation.navigate('Summary')}
          accessibilityRole="button"
          accessibilityLabel="Ver estadísticas"
        >
          <Ionicons name="stats-chart" size={18} color={colors.primary} />
          <Text style={styles.quickActionText}>Estadísticas</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setReportVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver resumen del día"
      >
        <Ionicons name="moon" size={18} color={colors.surface} />
        <Text style={styles.reportButtonText}>Resumen nocturno con IA</Text>
      </TouchableOpacity>

      <NightlyReportModal
        visible={reportVisible}
        stats={dayStats}
        onClose={() => setReportVisible(false)}
      />
    </ScrollView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl + 72,
      gap: SPACING.sm,
    },
    metricRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    quickActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    quickActionPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    quickActionSecondary: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    quickActionTextLight: {
      color: colors.surface,
      fontWeight: '800',
      fontSize: 13,
    },
    quickActionText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 13,
    },
    reportButton: {
      backgroundColor: colors.onSurface,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    reportButtonText: {
      color: colors.surface,
      fontWeight: '800',
      fontSize: 14,
    },
  });
