import { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SCREEN_MAX_CONTENT_WIDTH,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import { ScreenIntro } from '@/shared/ui/ScreenIntro';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { PromptModal } from '@/shared/ui/PromptModal';
import {
  isHabitDueToday,
  localDateKey,
  useProductivityStore,
} from '@/shared/domain/productivity/public';
import type { GoalGravity } from '@/shared/types/models';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import { useMirrorEffects } from '../hooks/useMirrorEffects';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '@/shared/navigation/types';
import { useI18n } from '@/shared/i18n/i18n';
import { useSettingsStore } from '@/shared/preferences/useSettingsStore';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';

export const CalendarScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        BottomTabNavigationProp<MainTabParamList, 'Calendar'>,
        NativeStackNavigationProp<RootStackParamList>
      >
    >();
  const { locale, t, formatDate } = useI18n();
  const daysHeader =
    locale === 'es' ? ['L', 'M', 'X', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const { events: googleEvents, connected: calendarConnected } = useGoogleCalendar();
  useMirrorEffects(calendarConnected);

  const goals = useProductivityStore((s) => s.goals);
  const habits = useProductivityStore((s) => s.habits);
  const addGoal = useProductivityStore((s) => s.addGoal);

  const todayKey = localDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [addGoalModalVisible, setAddGoalModalVisible] = useState(false);
  // La entrega rápida nace siempre normal: la importancia se ajusta en Metas,
  // no en la hoja de creación. Constante a propósito, no estado.
  const goalGravity: GoalGravity = 'low';
  // Agenda primero: 2 semanas por defecto, mes bajo demanda. Liviano en 320dp.
  const [expanded, setExpanded] = useState(false);
  // Descarte persistido: si el usuario la oculta, no vuelve al volver a la tab.
  const connectDismissed = useSettingsStore((s) => s.calendarConnectDismissed);
  const setConnectDismissed = useSettingsStore((s) => s.setCalendarConnectDismissed);
  const reduceMotion = useReduceMotion();
  const gridFade = useRef(new Animated.Value(1)).current;
  const listFade = useRef(new Animated.Value(1)).current;

  // Continuidad visual: fundido corto solo ante acción real (cambiar ventana,
  // día o expandir). Nunca al montar: movimiento sin causa se lee como parpadeo.
  const pulseContinuity = (target: Animated.Value) => {
    if (reduceMotion) return;
    target.setValue(0.35);
    Animated.timing(target, {
      toValue: 1,
      duration: theme.motion.duration.short4,
      useNativeDriver: true,
    }).start();
  };

  const toggleExpanded = () => {
    setExpanded((value) => !value);
    pulseContinuity(gridFade);
  };

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
      const dayGoogle = googleEvents.filter((event) => event.date === key);
      const total = dayGoals.length + dayGoogle.length;
      return {
        date,
        key,
        number: date.getDate(),
        inMonth: date.getMonth() === visibleMonth.getMonth(),
        isToday: key === todayKey,
        total,
        important: dayGoals.some((goal) => goal.gravity === 'high'),
      };
    });
  }, [visibleMonth, goals, googleEvents, todayKey]);

  // Solo 2 semanas alrededor del día seleccionado por defecto. Menos ruido,
  // celdas tocables en 320dp. Mes completo solo bajo demanda.
  const visibleDays = useMemo(() => {
    if (expanded) return calendarDays;
    const selectedIndex = calendarDays.findIndex((day) => day.key === selectedDate);
    const anchor = selectedIndex < 0 ? 0 : selectedIndex;
    const weekStart = Math.floor(anchor / 7) * 7;
    return calendarDays.slice(weekStart, weekStart + 14);
  }, [calendarDays, expanded, selectedDate]);

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
    // Conservar ancla: mismo número de día, no salto al día 1. Evita desorientar.
    const anchorDay = Number(selectedDate.split('-')[2] || '1');
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const clamped = Math.min(Math.max(anchorDay, 1), lastDay);
    const pad = (value: number) => String(value).padStart(2, '0');
    const nextSelected = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(clamped)}`;
    setVisibleMonth(next);
    setSelectedDate(nextSelected);
    pulseContinuity(gridFade);
    pulseContinuity(listFade);
  };

  const selectDay = (date: Date, key: string) => {
    setSelectedDate(key);
    if (date.getMonth() !== visibleMonth.getMonth()) {
      setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    pulseContinuity(listFade);
  };

  const goToday = () => {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
    pulseContinuity(gridFade);
    pulseContinuity(listFade);
  };

  const totalForSelectedDay =
    selectedDayInfo.goals.length +
    selectedDayInfo.habits.length +
    selectedDayInfo.googleEvents.length;
  const agendaItems = useMemo(
    () => [
      ...selectedDayInfo.googleEvents.map((item) => ({ kind: 'google' as const, item })),
      ...selectedDayInfo.goals.map((item) => ({ kind: 'goal' as const, item })),
      ...selectedDayInfo.habits.map((item) => ({ kind: 'habit' as const, item })),
    ],
    [selectedDayInfo],
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={agendaItems}
        keyExtractor={({ kind, item }) => `${kind}-${item.id}`}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ScreenIntro title={t('calendar.title')} subtitle={t('calendar.subtitle')} />

            <Animated.View style={[styles.calendarCard, { opacity: gridFade }]}>
              <View style={styles.monthHeader}>
                <TouchableOpacity
                  style={styles.monthButton}
                  onPress={() => moveMonth(-1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.previousMonth')}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
                <View style={styles.monthCopy}>
                  <Text style={styles.monthTitle}>
                    {formatDate(visibleMonth, { month: 'long', year: 'numeric' })}
                  </Text>
                  {visibleMonth.getMonth() !== new Date().getMonth() ||
                  visibleMonth.getFullYear() !== new Date().getFullYear() ? (
                    <TouchableOpacity
                      style={styles.todayButton}
                      onPress={goToday}
                      accessibilityRole="button"
                      accessibilityLabel={t('calendar.backToday')}
                    >
                      <Text style={styles.todayLink}>{t('calendar.backToday')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.monthButton}
                  onPress={() => moveMonth(1)}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.nextMonth')}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <View style={styles.daysHeader}>
                {daysHeader.map((day, index) => (
                  <Text key={`${day}-${index}`} style={styles.dayHeaderCell}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {visibleDays.map((day) => {
                  const selected = day.key === selectedDate;
                  const dayLabel = formatDate(day.date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  });
                  const dayCountLabel =
                    day.total === 1 ? t('calendar.activity') : t('calendar.activities');
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[styles.dayCell, selected && styles.dayCellSelected]}
                      onPress={() => selectDay(day.date, day.key)}
                      activeOpacity={0.72}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${dayLabel}, ${day.total} ${dayCountLabel}`}
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
                        {day.total > 0 ? (
                          <>
                            <View
                              style={[
                                styles.indicator,
                                {
                                  backgroundColor: selected
                                    ? colors.onPrimary
                                    : day.important
                                      ? colors.flame
                                      : colors.secondary,
                                },
                              ]}
                            />
                            {day.total > 1 ? (
                              <Text
                                style={[
                                  styles.indicatorCount,
                                  selected && styles.indicatorCountSelected,
                                ]}
                              >
                                {day.total}
                              </Text>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={toggleExpanded}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
              >
                <Text style={styles.expandText}>
                  {expanded ? t('calendar.showLess') : t('calendar.showMonth')}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.detailHeader, { opacity: listFade }]}>
              <View style={styles.detailHeaderCopy}>
                <Text style={styles.detailTitle}>
                  {formatDate(new Date(`${selectedDate}T00:00:00`), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                <Text style={styles.detailMeta}>
                  {totalForSelectedDay}{' '}
                  {totalForSelectedDay === 1 ? t('calendar.activity') : t('calendar.activities')}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setAddGoalModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.addDate')}
              >
                <Ionicons name="add" size={20} color={colors.onPrimary} />
              </TouchableOpacity>
            </Animated.View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyDay}>
            <SuiDoodle variant="calendar" size={58} color={colors.secondary} />
            <Text style={styles.emptyText}>{t('calendar.freeDay')}</Text>
          </View>
        }
        ListFooterComponent={
          !calendarConnected && !connectDismissed ? (
            totalForSelectedDay === 0 ? (
              <View style={styles.ghostRow}>
                <TouchableOpacity
                  style={styles.ghostMain}
                  onPress={() => navigation.navigate('Connections')}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.connectGhost')}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <View style={styles.ghostCopy}>
                    <Text style={styles.ghostTitle}>{t('calendar.connectTitle')}</Text>
                    <Text style={styles.ghostBody}>{t('calendar.connectBody')}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostDismiss}
                  onPress={() => setConnectDismissed(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.dismiss')}
                >
                  <Ionicons name="close" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ghostCompact}>
                <TouchableOpacity
                  style={styles.ghostMain}
                  onPress={() => navigation.navigate('Connections')}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.connectGhost')}
                >
                  <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                  <Text style={styles.ghostText}>{t('calendar.connectGhost')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostDismiss}
                  onPress={() => setConnectDismissed(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.dismiss')}
                >
                  <Ionicons name="close" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            )
          ) : null
        }
        renderItem={({ item: entry }) => {
          if (entry.kind === 'google') {
            return (
              <DayRow
                icon="calendar-outline"
                title={entry.item.title || t('calendar.untitledEvent')}
                meta={
                  entry.item.allDay
                    ? `${t('calendar.allDay')} · Google Calendar`
                    : `${entry.item.time ?? ''} · Google Calendar`
                }
                color={colors.primary}
                backgroundColor={colors.primaryContainer}
              />
            );
          }
          if (entry.kind === 'goal') {
            return (
              <DayRow
                icon="flag-outline"
                title={entry.item.title}
                meta={t('calendar.goalDeadline')}
                color={entry.item.gravity === 'high' ? colors.flame : colors.primary}
                backgroundColor={
                  entry.item.gravity === 'high' ? colors.flameContainer : colors.primaryContainer
                }
                onPress={() =>
                  navigation.navigate('Goals', { editId: entry.item.id, returnTo: 'Calendar' })
                }
              />
            );
          }
          return (
            <DayRow
              icon="repeat"
              title={entry.item.title}
              meta={t('calendar.habitRepeat')}
              color={colors.secondary}
              backgroundColor={colors.secondaryContainer}
              onPress={() =>
                navigation.navigate('Habits', { editId: entry.item.id, returnTo: 'Calendar' })
              }
            />
          );
        }}
      />

      <PromptModal
        visible={addGoalModalVisible}
        title={t('calendar.newDelivery')}
        hint={`${t('calendar.newDeliveryHint')} ${formatDate(new Date(`${selectedDate}T00:00:00`), {
          day: 'numeric',
          month: 'long',
        })}.`}
        placeholder={t('calendar.newDeliveryPlaceholder')}
        validate={(value) => (value ? null : t('calendar.titleRequired'))}
        onSubmit={(title) => {
          addGoal({ title, deadline: selectedDate, gravity: goalGravity });
          setAddGoalModalVisible(false);
        }}
        onCancel={() => setAddGoalModalVisible(false)}
      />
    </View>
  );
};

type DayRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  color: string;
  backgroundColor: string;
  onPress?: () => void;
};

const DayRow = ({ icon, title, meta, color, backgroundColor, onPress }: DayRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TouchableOpacity
      style={styles.dayRow}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.dayRowIcon, { backgroundColor }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={styles.dayRowCopy}>
        <Text style={styles.dayRowTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.dayRowMeta}>{meta}</Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: SPACING.sm,
      paddingTop: SPACING.sm,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING,
    },
    calendarCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: SPACING.sm,
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
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthCopy: { alignItems: 'center' },
    monthTitle: { ...type.titleMd, color: colors.onSurface, textTransform: 'capitalize' },
    todayLink: { ...type.labelSm, color: colors.primary, marginTop: 1 },
    todayButton: { minHeight: 44, justifyContent: 'center' },
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
      minHeight: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellSelected: { backgroundColor: colors.primary },
    dayNumber: { ...type.labelMd, color: colors.onSurface },
    dayNumberOutside: { color: colors.outline },
    dayNumberToday: { color: colors.primary },
    dayNumberSelected: { color: colors.onPrimary },
    indicatorRow: {
      height: 16,
      flexDirection: 'row',
      gap: 3,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    indicator: { width: 6, height: 6, borderRadius: 3 },
    indicatorCount: { ...type.labelSm, color: colors.onSurfaceVariant },
    indicatorCountSelected: { color: colors.onPrimary },
    expandButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: SPACING.xs,
    },
    expandText: { ...type.labelMd, color: colors.primary },
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
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyDay: {
      minHeight: 108,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    emptyText: { ...type.bodyMd, color: colors.onSurfaceVariant },
    ghostRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginTop: SPACING.sm,
    },
    ghostMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    ghostCopy: { flex: 1, gap: 2 },
    ghostTitle: { ...type.titleSm, color: colors.onSurface },
    ghostBody: { ...type.bodySm, color: colors.onSurfaceVariant },
    ghostText: { ...type.labelMd, color: colors.primary, flex: 1 },
    ghostDismiss: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ghostCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      marginTop: SPACING.sm,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
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
