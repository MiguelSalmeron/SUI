import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { LevelCard } from '../../components/home/LevelCard';
import { StreakBadge } from '../../components/home/StreakBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useHomeStore } from '../../store/useHomeStore';
import { useCelebrationStore } from '../../store/useCelebrationStore';
import { localDateKey } from '../../services/homeStorage';
import { loadCachedGoogleEvents, buildUnifiedTimeline } from '../../services/googleSync';
import type { GoogleEvent, TimelineItem } from '../../types/models';

export const OverviewScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const celebrate = useCelebrationStore((s) => s.trigger);

  const stateLoaded = useHomeStore((s) => s.stateLoaded);
  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const totalXp = useHomeStore((s) => s.totalXp);
  const toggleHabit = useHomeStore((s) => s.toggleHabit);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);

  const [selectedDate, setSelectedDate] = useState<string>(localDateKey());
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);

  useEffect(() => {
    loadCachedGoogleEvents().then(setGoogleEvents).catch(() => undefined);
  }, []);

  // Generar la franja horizontal de minicalendario (7 días centrados en hoy)
  const weekDays = useMemo(() => {
    const list = [];
    const today = new Date();
    // 3 días antes y 3 días después
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = localDateKey(d);
      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });

      // Ver si tiene actividad en ese día
      const hasGoal = goals.some((g) => g.deadline === key);
      const hasGoogle = googleEvents.some((g) => g.date === key);

      list.push({
        date: d,
        key,
        dayName: dayName.slice(0, 3).toUpperCase(),
        dayNum: d.getDate(),
        isToday: key === localDateKey(),
        hasActivity: hasGoal || hasGoogle,
      });
    }
    return list;
  }, [goals, googleEvents]);

  // Agenda Unificada del día seleccionado
  const timelineItems = useMemo<TimelineItem[]>(() => {
    return buildUnifiedTimeline(selectedDate, googleEvents, goals, habits);
  }, [selectedDate, googleEvents, goals, habits]);

  const handleToggleItem = (item: TimelineItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (item.origin === 'habit') {
      toggleHabit(item.originalId);
      if (!item.completed) {
        celebrate({ kind: 'habit', subtitle: `+5 XP · ${item.title}` });
      }
    } else if (item.origin === 'goal') {
      toggleGoal(item.originalId);
      if (!item.completed) {
        celebrate({ kind: 'goal', subtitle: `+10 XP · Meta completada` });
      }
    }
  };

  if (!stateLoaded) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Skeleton height={50} radius="lg" />
        <Skeleton height={90} radius="xl" />
        <Skeleton height={200} radius="lg" />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Nivel y Racha resumidos */}
      <View style={styles.topStatsRow}>
        <View style={{ flex: 1 }}>
          <LevelCard totalXp={totalXp} />
        </View>
      </View>

      {/* Mini-Calendar Bar Superior (Franja Deslizante) */}
      <View style={styles.miniCalendarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.miniCalendarScroll}
        >
          {weekDays.map((d) => {
            const isSelected = d.key === selectedDate;
            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.miniDayCell,
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => setSelectedDate(d.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.miniDayName,
                    isSelected && { color: colors.onPrimary },
                  ]}
                >
                  {d.dayName}
                </Text>
                <Text
                  style={[
                    styles.miniDayNum,
                    isSelected && { color: colors.onPrimary },
                    d.isToday && !isSelected && { color: colors.primary },
                  ]}
                >
                  {d.dayNum}
                </Text>
                {d.hasActivity && (
                  <View
                    style={[
                      styles.activityDot,
                      {
                        backgroundColor: isSelected
                          ? colors.onPrimary
                          : colors.primary,
                      },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Encabezado del Día Seleccionado */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {/* Agenda Unificada (Daily Timeline) */}
      <View style={styles.timelineList}>
        {timelineItems.length === 0 ? (
          <View style={styles.emptyDayBox}>
            <Ionicons name="sparkles-outline" size={32} color={colors.outline} />
            <Text style={styles.emptyDayText}>
              Sin actividades registradas para este día. ¡Disfruta tu tiempo!
            </Text>
          </View>
        ) : (
          timelineItems.map((item) => {
            const isGoogle = item.origin === 'google_calendar';
            const isHabit = item.origin === 'habit';
            const isGoal = item.origin === 'goal';

            return (
              <View key={item.id} style={styles.timelineRow}>
                {/* Hora */}
                <Text style={styles.timeText}>{item.time}</Text>

                {/* Badge de Origen */}
                <View
                  style={[
                    styles.badgeChip,
                    {
                      backgroundColor: isGoogle
                        ? colors.surfaceContainerHighest
                        : isHabit
                        ? colors.flameContainer
                        : colors.primaryContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      isGoogle
                        ? 'logo-google'
                        : isHabit
                        ? 'repeat'
                        : 'flag'
                    }
                    size={12}
                    color={
                      isGoogle
                        ? colors.onSurface
                        : isHabit
                        ? colors.flame
                        : colors.primary
                    }
                  />
                  <Text
                    style={[
                      styles.badgeChipText,
                      {
                        color: isGoogle
                          ? colors.onSurface
                          : isHabit
                          ? colors.flame
                          : colors.primary,
                      },
                    ]}
                  >
                    {isGoogle ? 'Google' : isHabit ? 'Hábito' : 'Meta'}
                  </Text>
                </View>

                {/* Título de la actividad */}
                <View style={styles.titleCol}>
                  <Text
                    style={[
                      styles.itemTitleText,
                      item.completed && !isGoogle && styles.itemDoneText,
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  {item.linkedGoalTitle && (
                    <Text style={styles.subText}>
                      🔗 Alimenta: {item.linkedGoalTitle}
                    </Text>
                  )}
                </View>

                {/* Acción 1-Tap (Check) */}
                {!isGoogle && (
                  <TouchableOpacity
                    style={[
                      styles.actionCheck,
                      item.completed && {
                        backgroundColor: colors.success,
                        borderColor: colors.success,
                      },
                    ]}
                    onPress={() => handleToggleItem(item)}
                  >
                    {item.completed && (
                      <Ionicons name="checkmark" size={14} color={colors.onSuccess} />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
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
    topStatsRow: {
      marginBottom: SPACING.xs,
    },
    miniCalendarContainer: {
      marginVertical: SPACING.md,
    },
    miniCalendarScroll: {
      gap: SPACING.xs + 2,
    },
    miniDayCell: {
      width: 48,
      height: 64,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    miniDayName: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.onSurfaceVariant,
    },
    miniDayNum: {
      fontSize: 16,
      fontWeight: '900',
      color: colors.onSurface,
    },
    activityDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 2,
    },
    dayHeader: {
      marginBottom: SPACING.md,
    },
    dayTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.onSurface,
      textTransform: 'capitalize',
    },
    timelineList: {
      gap: SPACING.sm,
    },
    emptyDayBox: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    emptyDayText: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      borderRadius: 14,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: SPACING.sm,
    },
    timeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
      width: 60,
    },
    badgeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    badgeChipText: {
      fontSize: 10,
      fontWeight: '800',
    },
    titleCol: {
      flex: 1,
    },
    itemTitleText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onSurface,
    },
    itemDoneText: {
      color: colors.onSurfaceVariant,
      textDecorationLine: 'line-through',
    },
    subText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    actionCheck: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
