import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import { ScreenIntro } from '@/shared/ui/ScreenIntro';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { PromptModal } from '@/shared/ui/PromptModal';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { isHabitDueToday, localDateKey } from '@/shared/domain/productivity/homeStorage';
import type { GoalGravity } from '@/shared/types/models';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';

const DAYS_HEADER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const CalendarScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    events: googleEvents,
    lastSyncedAt,
    status: calendarStatus,
    error: calendarError,
    configured: calendarConfigured,
    ready: calendarReady,
    connected: calendarConnected,
    platformHint,
    connectAndSync,
    disconnect,
  } = useGoogleCalendar();

  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const addGoal = useHomeStore((s) => s.addGoal);

  const todayKey = localDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [addGoalModalVisible, setAddGoalModalVisible] = useState(false);
  const [goalGravity] = useState<GoalGravity>('low');

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = localDateKey(date);
      const dayGoals = goals.filter(
        (goal) => goal.deadline === key || goal.impactDays?.includes(key),
      );
      return {
        date,
        key,
        number: date.getDate(),
        inMonth: date.getMonth() === visibleMonth.getMonth(),
        isToday: key === todayKey,
        hasGoal: dayGoals.length > 0,
        hasImportantGoal: dayGoals.some((goal) => goal.gravity === 'high'),
        hasGoogleEvent: googleEvents.some((event) => event.date === key),
      };
    });
  }, [visibleMonth, goals, googleEvents, todayKey]);

  const selectedDayInfo = useMemo(() => {
    const parts = selectedDate.split('-').map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return {
      goals: goals.filter(
        (goal) => goal.deadline === selectedDate || goal.impactDays?.includes(selectedDate),
      ),
      habits: habits.filter((habit) => isHabitDueToday(habit, date)),
      googleEvents: googleEvents.filter((event) => event.date === selectedDate),
    };
  }, [selectedDate, goals, habits, googleEvents]);

  const moveMonth = (delta: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
    setVisibleMonth(next);
    setSelectedDate(localDateKey(next));
  };

  const selectDay = (date: Date, key: string) => {
    setSelectedDate(key);
    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const syncLabel =
    calendarStatus === 'syncing'
      ? 'Sincronizando…'
      : calendarStatus === 'loading-cache'
        ? 'Cargando…'
        : calendarStatus === 'offline'
          ? 'Datos locales'
          : calendarConnected
            ? 'Conectado'
            : 'Sin conectar';
  const syncBusy = calendarStatus === 'syncing' || calendarStatus === 'loading-cache';
  const totalForSelectedDay =
    selectedDayInfo.goals.length +
    selectedDayInfo.habits.length +
    selectedDayInfo.googleEvents.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenIntro title="Agenda" subtitle="Todo lo que tiene fecha, reunido en un lugar." />

      <View style={styles.connectionCard}>
        <View style={styles.connectionIcon}>
          <Ionicons name="logo-google" size={19} color={colors.primary} />
        </View>
        <View style={styles.connectionCopy}>
          <Text style={styles.connectionTitle}>Google Calendar</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: calendarConnected ? colors.success : colors.outline },
              ]}
            />
            <Text style={styles.connectionStatus}>{syncLabel}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.syncButton, (!calendarReady || syncBusy) && styles.syncButtonDisabled]}
          onPress={() => void connectAndSync()}
          disabled={!calendarReady || syncBusy}
          accessibilityRole="button"
          accessibilityLabel={calendarConnected ? 'Actualizar calendario' : 'Conectar calendario'}
        >
          <Ionicons
            name={calendarConnected ? 'refresh' : 'link-outline'}
            size={17}
            color={colors.primary}
          />
          <Text style={styles.syncButtonText}>{calendarConnected ? 'Actualizar' : 'Conectar'}</Text>
        </TouchableOpacity>
      </View>
      {calendarError || platformHint || !calendarConfigured ? (
        <View style={styles.connectionMessage}>
          <Text style={[styles.connectionMessageText, calendarError && { color: colors.error }]}>
            {calendarError ?? platformHint ?? 'Configura el Client ID de Google para activar la conexión.'}
          </Text>
          {calendarConnected ? (
            <TouchableOpacity onPress={() => void disconnect()}>
              <Text style={styles.disconnectText}>Desconectar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : lastSyncedAt ? (
        <View style={styles.connectionFooter}>
          <Text style={styles.lastSyncText}>
            Actualizado {new Date(lastSyncedAt).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {calendarConnected ? (
            <TouchableOpacity onPress={() => void disconnect()}>
              <Text style={styles.disconnectText}>Desconectar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => moveMonth(-1)}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
          >
            <Ionicons name="chevron-back" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <View style={styles.monthCopy}>
            <Text style={styles.monthTitle}>
              {visibleMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </Text>
            {visibleMonth.getMonth() !== new Date().getMonth() ||
            visibleMonth.getFullYear() !== new Date().getFullYear() ? (
              <TouchableOpacity
                onPress={() => {
                  const today = new Date();
                  setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDate(todayKey);
                }}
              >
                <Text style={styles.todayLink}>Volver a hoy</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.monthButton}
            onPress={() => moveMonth(1)}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
          >
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.daysHeader}>
          {DAYS_HEADER.map((day) => (
            <Text key={day} style={styles.dayHeaderCell}>{day}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {calendarDays.map((day) => {
            const selected = day.key === selectedDate;
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.dayCell, selected && styles.dayCellSelected]}
                onPress={() => selectDay(day.date, day.key)}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={day.date.toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    !day.inMonth && styles.dayNumberOutside,
                    day.isToday && !selected && styles.dayNumberToday,
                    selected && styles.dayNumberSelected,
                  ]}
                >
                  {day.number}
                </Text>
                <View style={styles.indicatorRow}>
                  {day.hasGoogleEvent ? (
                    <View style={[styles.indicator, { backgroundColor: selected ? colors.onPrimary : colors.primary }]} />
                  ) : null}
                  {day.hasGoal ? (
                    <View
                      style={[
                        styles.indicator,
                        {
                          backgroundColor: selected
                            ? colors.onPrimary
                            : day.hasImportantGoal
                              ? colors.flame
                              : colors.secondary,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderCopy}>
          <Text style={styles.detailTitle}>
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-ES', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </Text>
          <Text style={styles.detailMeta}>
            {totalForSelectedDay} {totalForSelectedDay === 1 ? 'actividad' : 'actividades'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddGoalModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Añadir entrega en esta fecha"
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayList}>
        {totalForSelectedDay === 0 ? (
          <View style={styles.emptyDay}>
            <SuiDoodle variant="calendar" size={58} color={colors.secondary} />
            <Text style={styles.emptyText}>Este día está libre.</Text>
          </View>
        ) : (
          <>
            {selectedDayInfo.googleEvents.map((event) => (
              <DayRow
                key={`google-${event.id}`}
                icon="calendar-outline"
                title={event.title}
                meta={event.allDay ? 'Todo el día · Google Calendar' : `${event.time ?? ''} · Google Calendar`}
                color={colors.primary}
                backgroundColor={colors.primaryContainer}
              />
            ))}
            {selectedDayInfo.goals.map((goal) => (
              <DayRow
                key={goal.id}
                icon="flag-outline"
                title={goal.title}
                meta="Fecha límite · Meta"
                color={goal.gravity === 'high' ? colors.flame : colors.primary}
                backgroundColor={goal.gravity === 'high' ? colors.flameContainer : colors.primaryContainer}
              />
            ))}
            {selectedDayInfo.habits.map((habit) => (
              <DayRow
                key={habit.id}
                icon="repeat"
                title={habit.title}
                meta="Repetición · Hábito"
                color={colors.secondary}
                backgroundColor={colors.secondaryContainer}
              />
            ))}
          </>
        )}
      </View>

      <PromptModal
        visible={addGoalModalVisible}
        title="Nueva entrega"
        hint={`Se añadirá a Metas con fecha ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('es-ES', {
          day: 'numeric', month: 'long',
        })}.`}
        placeholder="Ej. Examen parcial de Física"
        validate={(value) => (value ? null : 'Escribe un título')}
        onSubmit={(title) => {
          addGoal({ title, deadline: selectedDate, gravity: goalGravity });
          setAddGoalModalVisible(false);
        }}
        onCancel={() => setAddGoalModalVisible(false)}
      />
    </ScrollView>
  );
};

type DayRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  color: string;
  backgroundColor: string;
};

const DayRow = ({ icon, title, meta, color, backgroundColor }: DayRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.dayRow}>
      <View style={[styles.dayRowIcon, { backgroundColor }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={styles.dayRowCopy}>
        <Text style={styles.dayRowTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.dayRowMeta}>{meta}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING,
    },
    connectionCard: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    connectionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryContainer,
    },
    connectionCopy: { flex: 1 },
    connectionTitle: { ...type.titleSm, color: colors.onSurface },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    connectionStatus: { ...type.bodySm, color: colors.onSurfaceVariant },
    syncButton: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: 20,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: SPACING.md,
    },
    syncButtonDisabled: { opacity: 0.48 },
    syncButtonText: { ...type.labelMd, color: colors.primary },
    connectionMessage: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      marginBottom: SPACING.md,
    },
    connectionMessageText: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
    disconnectText: { ...type.labelSm, color: colors.error },
    lastSyncText: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      flex: 1,
    },
    connectionFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.sm,
      marginBottom: SPACING.md,
    },
    calendarCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: SPACING.md,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xl,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    monthButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthCopy: { alignItems: 'center' },
    monthTitle: { ...type.titleMd, color: colors.onSurface, textTransform: 'capitalize' },
    todayLink: { ...type.labelSm, color: colors.primary, marginTop: 1 },
    daysHeader: { flexDirection: 'row', marginBottom: SPACING.xs },
    dayHeaderCell: {
      width: '14.285%',
      textAlign: 'center',
      ...type.labelSm,
      color: colors.onSurfaceVariant,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: '14.285%',
      aspectRatio: 0.9,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellSelected: { backgroundColor: colors.primary },
    dayNumber: { ...type.labelMd, color: colors.onSurface },
    dayNumberOutside: { color: colors.outline },
    dayNumberToday: { color: colors.primary },
    dayNumberSelected: { color: colors.onPrimary },
    indicatorRow: { height: 5, flexDirection: 'row', gap: 2, marginTop: 2 },
    indicator: { width: 4, height: 4, borderRadius: 2 },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      marginBottom: SPACING.sm,
    },
    detailHeaderCopy: { flex: 1 },
    detailTitle: { ...type.titleLg, color: colors.onSurface, textTransform: 'capitalize' },
    detailMeta: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    addButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayList: { gap: SPACING.sm },
    emptyDay: {
      minHeight: 108,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    emptyText: { ...type.bodyMd, color: colors.onSurfaceVariant },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
    },
    dayRowIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayRowCopy: { flex: 1 },
    dayRowTitle: { ...type.titleSm, color: colors.onSurface },
    dayRowMeta: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
  });
};
