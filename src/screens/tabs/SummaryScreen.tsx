import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { useHomeStore } from '../../store/useHomeStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';

export const SummaryScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);

  const completedGoals = useMemo(() => goals.filter((g) => g.completed).length, [goals]);
  const completedHabits = useMemo(() => habits.filter((h) => h.completed).length, [habits]);

  const weeklySummary = useMemo(() => {
    if (goals.length === 0 && habits.length === 0) {
      return 'Empieza hoy: agrega una meta, registra un hábito y configura tu pomodoro.';
    }
    return `Metas: ${completedGoals}/${goals.length} | Hábitos: ${completedHabits}/${habits.length} | Pomodoros: ${pomodoroSessions}`;
  }, [completedGoals, completedHabits, goals.length, habits.length, pomodoroSessions]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Resumen semanal</Text>
        <Text style={styles.sectionSubtitle}>Una vista rápida de tu progreso</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryText}>{weeklySummary}</Text>
      </View>
    </ScrollView>
  );
};

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
      fontSize: 18,
      fontWeight: '800',
      color: colors.onSurface,
    },
    sectionSubtitle: {
      marginTop: 4,
      color: colors.onSurfaceVariant,
      fontSize: 14,
    },
    summaryCard: {
      backgroundColor: colors.primary,
      borderRadius: 22,
      padding: SPACING.lg,
    },
    summaryText: {
      color: colors.surface,
      fontSize: 15,
      lineHeight: 22,
    },
  });
