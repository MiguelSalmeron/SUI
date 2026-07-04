import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { DailyProgress } from '../../components/home/DailyProgress';
import { StreakBadge } from '../../components/home/StreakBadge';
import { NightlyReportModal } from '../../components/home/NightlyReportModal';
import { useHomeStore } from '../../store/useHomeStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { scheduleNightlyReport, isNightlyReportResponse } from '../../services/notifications';
import { buildGreeting } from '../../services/greeting';
import type { DayStats } from '../../services/reportPrompt';

export const OverviewScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const pomodoroMinutes = usePomodoroStore((s) => s.pomodoroMinutes);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);

  const navigation = useNavigation<any>();
  const [reportVisible, setReportVisible] = useState(false);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);
  const dailyTotal = goals.length + habits.length;
  const dailyCompleted = completedGoals + completedHabits;

  const dayStats = useMemo<DayStats>(() => {
    const all = [...goals, ...habits];
    return {
      completed: all.filter((i) => i.completed).map((i) => i.title),
      pending: all.filter((i) => !i.completed).map((i) => i.title),
      streak,
    };
  }, [goals, habits, streak]);

  // Notificación del reporte nocturno
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
      {/* Streak */}
      <StreakBadge streak={streak} />

      {/* Daily progress */}
      <DailyProgress completed={dailyCompleted} total={dailyTotal} label="completados" />

      {/* Metric cards */}
      <View style={styles.metricPrimary}>
        <Text style={styles.metricLabelLight}>Metas activas</Text>
        <Text style={styles.metricValueLight}>{goals.length - completedGoals}</Text>
        <Text style={styles.metricHintLight}>{completedGoals} completadas</Text>
      </View>

      <View style={styles.metricSecondary}>
        <Text style={styles.metricLabelLight}>Hábitos activos</Text>
        <Text style={styles.metricValueLight}>{habits.length - completedHabits}</Text>
        <Text style={styles.metricHintLight}>{completedHabits} marcados</Text>
      </View>

      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>Pomodoro</Text>
        <Text style={styles.metricValue}>{pomodoroMinutes} min</Text>
        <Text style={styles.metricHint}>{pomodoroSessions} sesiones</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionPrimary} onPress={() => navigation.navigate('Goals')} accessibilityRole="button" accessibilityLabel="Ir a metas">
          <Text style={styles.quickActionTextLight}>Ir a metas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionSecondary} onPress={() => navigation.navigate('Pomodoro')} accessibilityRole="button" accessibilityLabel="Abrir pomodoro">
          <Text style={styles.quickActionText}>Abrir pomodoro</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => setReportVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver resumen del día"
      >
        <Text style={styles.reportButtonText}>Ver resumen del día</Text>
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
    metricCard: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    metricPrimary: {
      backgroundColor: colors.primary,
      borderRadius: 22,
      padding: SPACING.lg,
    },
    metricSecondary: {
      backgroundColor: colors.secondary,
      borderRadius: 22,
      padding: SPACING.lg,
    },
    metricLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      textTransform: 'uppercase',
    },
    metricValue: {
      fontSize: 34,
      fontWeight: '900',
      color: colors.onSurface,
      marginTop: 2,
    },
    metricHint: {
      color: colors.onSurfaceVariant,
      marginTop: 4,
      fontSize: 13,
    },
    metricLabelLight: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.surface,
      textTransform: 'uppercase',
    },
    metricValueLight: {
      fontSize: 34,
      fontWeight: '900',
      color: colors.surface,
      marginTop: 2,
    },
    metricHintLight: {
      color: colors.surface,
      marginTop: 4,
      fontSize: 13,
      opacity: 0.9,
    },
    quickActions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    quickActionPrimary: {
      flex: 1,
      backgroundColor: colors.primary,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
    },
    quickActionSecondary: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    quickActionTextLight: {
      color: colors.surface,
      fontWeight: '800',
    },
    quickActionText: {
      color: colors.primary,
      fontWeight: '800',
    },
    reportButton: {
      backgroundColor: colors.onSurface,
      padding: SPACING.md,
      borderRadius: 18,
      alignItems: 'center',
    },
    reportButtonText: {
      color: colors.surface,
      fontWeight: '800',
    },
  });
