import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';
import { isHabitDueToday, localDateKey } from '@/shared/domain/productivity/homeStorage';
import type { Habit } from '@/shared/types/models';
import { HabitFormModal } from '../components/HabitFormModal';
import { useI18n } from '@/shared/i18n/i18n';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/application/navigation/types';

type Filter = 'today' | 'all';

export const HabitsScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const celebrate = useCelebrationStore((s) => s.trigger);
  const { t } = useI18n();
  const route = useRoute<RouteProp<MainTabParamList, 'Habits'>>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Habits'>>();

  const habits = useHomeStore((s) => s.habits);
  const goals = useHomeStore((s) => s.goals);
  const addHabit = useHomeStore((s) => s.addHabit);
  const toggleHabit = useHomeStore((s) => s.toggleHabit);
  const freezeStreak = useHomeStore((s) => s.freezeStreak);
  const removeHabit = useHomeStore((s) => s.removeHabit);

  const [filter, setFilter] = useState<Filter>('today');
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    if (!route.params?.create) return;
    setFormVisible(true);
    navigation.setParams({ create: undefined });
  }, [navigation, route.params?.create]);

  const todayHabits = useMemo(() => habits.filter((habit) => isHabitDueToday(habit)), [habits]);
  const completedToday = todayHabits.filter((habit) => habit.completed).length;
  const progress = todayHabits.length
    ? Math.round((completedToday / todayHabits.length) * 100)
    : 0;
  const visibleHabits = filter === 'today' ? todayHabits : habits;

  const confirmRemove = (habit: Habit) => {
    Alert.alert(
      t('habits.delete'),
      t('habits.deleteBody', { title: habit.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('goals.remove'), style: 'destructive', onPress: () => removeHabit(habit.id) },
      ],
    );
  };

  const openActions = (habit: Habit) => {
    const frozen = Boolean(habit.frozenUntil && habit.frozenUntil >= localDateKey());
    Alert.alert(habit.title, t('habits.chooseAction'), [
      ...(!frozen
        ? [{ text: t('habits.protectStreak'), onPress: () => freezeStreak(habit.id) }]
        : []),
      { text: t('goals.remove'), style: 'destructive' as const, onPress: () => confirmRemove(habit) },
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const toggle = (habit: Habit) => {
    const linkedGoal = goals.find((goal) => goal.id === habit.linkedGoalId);
    toggleHabit(habit.id);
    if (!habit.completed) {
      celebrate({
        kind: 'habit',
        subtitle: linkedGoal
          ? t('celebration.habitGoalXp', { title: linkedGoal.title })
          : t('celebration.habitXp', { title: habit.title }),
      });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenIntro
        title={t('habits.title')}
        subtitle={t('habits.subtitle')}
        actionLabel={t('habits.create')}
        onAction={() => setFormVisible(true)}
      />

      <View style={styles.todayCard}>
        <View style={styles.todayTopRow}>
          <View>
            <Text style={styles.todayLabel}>{t('habits.todayConsistency')}</Text>
            <Text style={styles.todayCount}>
              {todayHabits.length
                ? t('habits.completedCount', { done: completedToday, total: todayHabits.length })
                : t('habits.noneToday')}
            </Text>
          </View>
          <View style={styles.percentCircle}>
            <Text style={styles.percentText}>{progress}%</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.todayNote}>
          {progress === 100 && todayHabits.length > 0
            ? t('habits.completeNote')
            : t('habits.progressNote')}
        </Text>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filter, filter === 'today' && styles.filterActive]}
          onPress={() => setFilter('today')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'today' }}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>{t('habits.today')}</Text>
          <View style={[styles.countBadge, filter === 'today' && styles.countBadgeActive]}>
            <Text style={[styles.countText, filter === 'today' && styles.countTextActive]}>{todayHabits.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filter, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'all' }}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>{t('habits.mine')}</Text>
          <View style={[styles.countBadge, filter === 'all' && styles.countBadgeActive]}>
            <Text style={[styles.countText, filter === 'all' && styles.countTextActive]}>{habits.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {visibleHabits.length === 0 ? (
        <View style={styles.emptyCard}>
          <SuiDoodle variant="rhythm" size={76} color={colors.secondary} />
          <Text style={styles.emptyTitle}>
            {filter === 'today' ? t('habits.emptyToday') : t('habits.emptyAll')}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'today'
              ? t('habits.emptyTodayBody')
              : t('habits.emptyAllBody')}
          </Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={() => (filter === 'today' && habits.length ? setFilter('all') : setFormVisible(true))}
          >
            <Text style={styles.emptyActionText}>
              {filter === 'today' && habits.length ? t('habits.viewMine') : t('habits.first')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.habitList}>
          {visibleHabits.map((habit) => {
            const linkedGoal = goals.find((goal) => goal.id === habit.linkedGoalId);
            const frozen = Boolean(habit.frozenUntil && habit.frozenUntil >= localDateKey());
            const frequencyLabel =
              habit.frequency === 'daily'
                ? t('habits.everyDay')
                : t('habits.daysPerWeek', { count: habit.frequency.length });

            return (
              <View key={habit.id} style={styles.habitCard}>
                <TouchableOpacity
                  style={[styles.checkButton, habit.completed && styles.checkButtonDone]}
                  onPress={() => toggle(habit)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: habit.completed }}
                  accessibilityLabel={habit.title}
                >
                  {habit.completed ? (
                    <Ionicons name="checkmark" size={19} color={colors.onSecondary} />
                  ) : null}
                </TouchableOpacity>

                <View style={styles.habitCopy}>
                  <Text style={[styles.habitTitle, habit.completed && styles.habitDone]} numberOfLines={2}>
                    {habit.title}
                  </Text>
                  <View style={styles.metadataRow}>
                    <Ionicons name="calendar-outline" size={13} color={colors.onSurfaceVariant} />
                    <Text style={styles.metadataText}>{frequencyLabel}</Text>
                  </View>
                  {linkedGoal ? (
                    <View style={styles.goalLink}>
                      <Ionicons name="flag-outline" size={13} color={colors.primary} />
                      <Text style={styles.goalLinkText} numberOfLines={1}>
                        {t('habits.drivesGoal', { title: linkedGoal.title })}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.trailing}>
                  <View style={[styles.streakPill, frozen && styles.frozenPill]}>
                    <Ionicons
                      name={frozen ? 'snow-outline' : 'flame'}
                      size={15}
                      color={frozen ? colors.primary : colors.flame}
                    />
                    <Text style={[styles.streakText, frozen && { color: colors.primary }]}>{habit.streak}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => openActions(habit)}
                    accessibilityRole="button"
                    accessibilityLabel={t('habits.actionsLabel', { title: habit.title })}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <HabitFormModal
        visible={formVisible}
        goals={goals}
        onSubmit={(draft) => {
          addHabit(draft);
          setFormVisible(false);
          setFilter('today');
        }}
        onCancel={() => setFormVisible(false)}
      />
    </ScrollView>
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
    todayCard: {
      backgroundColor: colors.secondaryContainer,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    todayTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    todayLabel: { ...type.titleMd, color: colors.onSecondaryContainer },
    todayCount: {
      ...type.bodySm,
      color: colors.onSecondaryContainer,
      opacity: 0.75,
      marginTop: 1,
    },
    percentCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    percentText: { ...type.labelLg, color: colors.secondary },
    progressTrack: {
      height: 8,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.flame },
    todayNote: {
      ...type.bodySm,
      color: colors.onSecondaryContainer,
      opacity: 0.8,
      marginTop: SPACING.sm,
    },
    filters: {
      flexDirection: 'row',
      gap: SPACING.xs,
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      padding: SPACING.xs,
      marginBottom: SPACING.md,
    },
    filter: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    filterActive: { backgroundColor: colors.surface },
    filterText: { ...type.labelMd, color: colors.onSurfaceVariant },
    filterTextActive: { color: colors.onSurface },
    countBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.surfaceContainerHighest,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    countBadgeActive: { backgroundColor: colors.secondaryContainer },
    countText: { ...type.labelSm, color: colors.onSurfaceVariant },
    countTextActive: { color: colors.onSecondaryContainer },
    emptyCard: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.xl,
      padding: SPACING.xl,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    emptyTitle: { ...type.titleMd, color: colors.onSurface, textAlign: 'center' },
    emptyText: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    emptyAction: {
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: colors.secondary,
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      marginTop: SPACING.lg,
    },
    emptyActionText: { ...type.labelLg, color: colors.onSecondary },
    habitList: { gap: SPACING.sm },
    habitCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
    },
    checkButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButtonDone: { backgroundColor: colors.secondary, borderColor: colors.secondary },
    habitCopy: { flex: 1, minWidth: 0 },
    habitTitle: { ...type.titleMd, color: colors.onSurface },
    habitDone: { color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
    metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    metadataText: { ...type.bodySm, color: colors.onSurfaceVariant },
    goalLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    goalLinkText: { ...type.bodySm, color: colors.primary, flex: 1 },
    trailing: { alignItems: 'center', gap: SPACING.xs },
    streakPill: {
      minWidth: 40,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.flameContainer,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingHorizontal: 7,
    },
    frozenPill: { backgroundColor: colors.primaryContainer },
    streakText: { ...type.labelMd, color: colors.flame },
    menuButton: {
      width: 34,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};
