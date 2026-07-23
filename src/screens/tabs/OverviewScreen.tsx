import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { DailyProgress } from '../../components/home/DailyProgress';
import { StreakBadge } from '../../components/home/StreakBadge';
import { LevelCard } from '../../components/home/LevelCard';
import { AchievementGrid } from '../../components/home/AchievementGrid';
import { NightlyReportModal } from '../../components/home/NightlyReportModal';
import { PressableCard } from '../../components/ui/PressableCard';
import { useHomeStore } from '../../store/useHomeStore';
import { usePomodoroStore } from '../../store/usePomodoroStore';
import { scheduleNightlyReport, isNightlyReportResponse } from '../../services/notifications';
import { getAchievements } from '../../services/gamification';
import { buildGreeting } from '../../services/greeting';
import type { DayStats } from '../../services/reportPrompt';

type TileProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint: string;
  colors: ColorScheme;
};

const Tile = ({ icon, label, value, hint, colors }: TileProps) => (
  <View style={tileStyles(colors).tile}>
    <Ionicons name={icon} size={18} color={colors.primary} />
    <Text style={tileStyles(colors).value}>{value}</Text>
    <Text style={tileStyles(colors).label}>{label}</Text>
    <Text style={tileStyles(colors).hint}>{hint}</Text>
  </View>
);

const tileStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      padding: SPACING.md,
      gap: 2,
    },
    value: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
      marginTop: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: colors.onSurfaceVariant,
    },
    hint: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
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

  const greeting = useMemo(
    () =>
      buildGreeting({
        hour: new Date().getHours(),
        completed: dailyCompleted,
        total: dailyTotal,
      }),
    [dailyCompleted, dailyTotal],
  );

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
      {/* Zona Hero: saludo + nivel + racha */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>
          {new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        <Text style={styles.heroGreeting}>
          {greeting.salutation} {greeting.emoji}
        </Text>
        <Text style={styles.heroSubline}>{greeting.subline}</Text>
      </View>

      <LevelCard totalXp={totalXp} />
      <StreakBadge streak={streak} />

      {/* Zona Hoy: progreso + tiles informativos */}
      <DailyProgress completed={dailyCompleted} total={dailyTotal} label="completados" />

      <View style={styles.tileRow}>
        <Tile
          icon="flag"
          label="Metas"
          value={`${completedGoals}/${goals.length}`}
          hint="hechas hoy"
          colors={colors}
        />
        <Tile
          icon="repeat"
          label="Hábitos"
          value={`${completedHabits}/${habits.length}`}
          hint="hechos hoy"
          colors={colors}
        />
        <Tile
          icon="timer"
          label="Enfoque"
          value={String(pomodoroSessions)}
          hint="sesiones"
          colors={colors}
        />
      </View>

      {/* CTA principal */}
      <PressableCard
        onPress={() => navigation.navigate('Pomodoro')}
        level="level2"
        radius="lg"
        backgroundColor={colors.primary}
        stateLayerColor={colors.onPrimary}
        contentStyle={styles.ctaContent}
        accessibilityLabel="Iniciar sesión de enfoque"
        accessibilityHint="Abre el temporizador Pomodoro"
      >
        <Ionicons name="timer-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.ctaText}>Iniciar sesión de enfoque</Text>
      </PressableCard>

      {/* Logros */}
      <AchievementGrid achievements={achievements} compact />

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
    hero: {
      marginBottom: SPACING.xs,
    },
    heroKicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: colors.secondary,
      marginBottom: 4,
    },
    heroGreeting: {
      fontSize: 26,
      fontWeight: '900',
      color: colors.onSurface,
      lineHeight: 32,
    },
    heroSubline: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginTop: 4,
      fontWeight: '600',
    },
    tileRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    ctaContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: SPACING.md,
    },
    ctaText: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
  });
