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
import { PromptModal } from '@/shared/ui/PromptModal';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';
import type { Goal } from '@/shared/types/models';
import { GoalFormModal } from '../components/GoalFormModal';
import { useI18n } from '@/shared/i18n/i18n';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '@/application/navigation/types';

type Filter = 'active' | 'completed';

const daysUntil = (dateKey: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${dateKey}T00:00:00`);
  return Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
};

export const GoalsScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const celebrate = useCelebrationStore((s) => s.trigger);
  const { t, formatDate } = useI18n();
  const route = useRoute<RouteProp<MainTabParamList, 'Goals'>>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList, 'Goals'>>();

  const goals = useHomeStore((s) => s.goals);
  const addGoal = useHomeStore((s) => s.addGoal);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);
  const addMilestone = useHomeStore((s) => s.addMilestone);
  const toggleMilestone = useHomeStore((s) => s.toggleMilestone);
  const removeGoal = useHomeStore((s) => s.removeGoal);

  const [filter, setFilter] = useState<Filter>('active');
  const [formVisible, setFormVisible] = useState(false);
  const [milestoneGoalId, setMilestoneGoalId] = useState<string | null>(null);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!route.params?.create) return;
    setFormVisible(true);
    navigation.setParams({ create: undefined });
  }, [navigation, route.params?.create]);

  const activeGoals = useMemo(
    () => goals.filter((goal) => !goal.completed).sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [goals],
  );
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completed), [goals]);
  const visibleGoals = filter === 'active' ? activeGoals : completedGoals;
  const importantCount = activeGoals.filter((goal) => goal.gravity === 'high').length;

  const confirmRemove = (goal: Goal) => {
    Alert.alert(
      t('goals.delete'),
      t('goals.deleteBody', { title: goal.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('goals.remove'), style: 'destructive', onPress: () => removeGoal(goal.id) },
      ],
    );
  };

  const openActions = (goal: Goal) => {
    Alert.alert(goal.title, t('goals.chooseAction'), [
      {
        text: goal.completed ? t('goals.reopen') : t('goals.markComplete'),
        onPress: () => toggleGoal(goal.id),
      },
      { text: t('goals.remove'), style: 'destructive', onPress: () => confirmRemove(goal) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenIntro
        title={t('goals.title')}
        subtitle={t('goals.subtitle')}
        actionLabel={t('goals.create')}
        onAction={() => setFormVisible(true)}
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{activeGoals.length}</Text>
          <Text style={styles.summaryLabel}>{t('goals.activeLower')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, importantCount > 0 && { color: colors.flame }]}>{importantCount}</Text>
          <Text style={styles.summaryLabel}>{t('goals.importantLower')}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{completedGoals.length}</Text>
          <Text style={styles.summaryLabel}>{t('goals.completedLower')}</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filter, filter === 'active' && styles.filterActive]}
          onPress={() => setFilter('active')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'active' }}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>{t('goals.active')}</Text>
          <View style={[styles.countBadge, filter === 'active' && styles.countBadgeActive]}>
            <Text style={[styles.countText, filter === 'active' && styles.countTextActive]}>{activeGoals.length}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filter, filter === 'completed' && styles.filterActive]}
          onPress={() => setFilter('completed')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filter === 'completed' }}
        >
          <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>{t('goals.completed')}</Text>
          <View style={[styles.countBadge, filter === 'completed' && styles.countBadgeActive]}>
            <Text style={[styles.countText, filter === 'completed' && styles.countTextActive]}>{completedGoals.length}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {visibleGoals.length === 0 ? (
        <View style={styles.emptyCard}>
          <SuiDoodle variant="path" size={76} />
          <Text style={styles.emptyTitle}>
            {filter === 'active' ? t('goals.emptyActive') : t('goals.emptyCompleted')}
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'active'
              ? t('goals.emptyActiveBody')
              : t('goals.emptyCompletedBody')}
          </Text>
          {filter === 'active' ? (
            <TouchableOpacity style={styles.emptyAction} onPress={() => setFormVisible(true)}>
              <Text style={styles.emptyActionText}>{t('goals.first')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.goalList}>
          {visibleGoals.map((goal) => {
            const expanded = expandedGoalId === goal.id;
            const remaining = daysUntil(goal.deadline);
            const milestonesDone = goal.milestones.filter((item) => item.completed).length;

            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.priorityPill,
                      goal.gravity === 'high' && styles.priorityPillImportant,
                    ]}
                  >
                    <View
                      style={[
                        styles.priorityDot,
                        { backgroundColor: goal.gravity === 'high' ? colors.flame : colors.secondary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.priorityText,
                        goal.gravity === 'high' && { color: colors.onFlameContainer },
                      ]}
                    >
                      {goal.gravity === 'high' ? t('goals.important') : t('goals.normal')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => openActions(goal)}
                    accessibilityRole="button"
                    accessibilityLabel={t('goals.actionsLabel', { title: goal.title })}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.goalTitle, goal.completed && styles.goalTitleDone]}>{goal.title}</Text>
                <View style={styles.deadlineRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.onSurfaceVariant} />
                  <Text style={styles.deadlineText}>{formatDate(new Date(`${goal.deadline}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  {!goal.completed && remaining <= 7 ? (
                    <Text style={[styles.remainingText, remaining < 0 && { color: colors.error }]}>
                      {remaining < 0 ? t('goals.overdue') : remaining === 0 ? t('goals.today') : t('goals.days', { count: remaining })}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>{t('goals.progress')}</Text>
                  <Text style={styles.progressValue}>{goal.progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${goal.progress}%`,
                        backgroundColor: goal.completed ? colors.success : colors.primary,
                      },
                    ]}
                  />
                </View>

                <TouchableOpacity
                  style={styles.milestoneSummary}
                  onPress={() => setExpandedGoalId(expanded ? null : goal.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                >
                  <View style={styles.milestoneSummaryCopy}>
                    <Ionicons name="list-outline" size={17} color={colors.primary} />
                    <Text style={styles.milestoneSummaryText}>
                      {goal.milestones.length
                        ? t('goals.milestones', { done: milestonesDone, total: goal.milestones.length })
                        : t('goals.addMilestones')}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.milestoneList}>
                    {goal.milestones.map((milestone) => (
                      <TouchableOpacity
                        key={milestone.id}
                        style={styles.milestoneRow}
                        onPress={() => {
                          toggleMilestone(goal.id, milestone.id);
                          if (!milestone.completed) {
                            celebrate({ kind: 'goal', subtitle: t('goals.milestoneDone', { title: milestone.title }) });
                          }
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: milestone.completed }}
                      >
                        <Ionicons
                          name={milestone.completed ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={milestone.completed ? colors.success : colors.outline}
                        />
                        <Text style={[styles.milestoneText, milestone.completed && styles.milestoneDone]}>
                          {milestone.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.addMilestone}
                      onPress={() => setMilestoneGoalId(goal.id)}
                    >
                      <Ionicons name="add" size={17} color={colors.primary} />
                      <Text style={styles.addMilestoneText}>{t('goals.addMilestone')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <GoalFormModal
        visible={formVisible}
        onSubmit={(draft) => {
          addGoal(draft);
          setFormVisible(false);
          setFilter('active');
        }}
        onCancel={() => setFormVisible(false)}
      />

      <PromptModal
        visible={milestoneGoalId !== null}
        title={t('goalForm.milestoneTitle')}
        hint={t('goalForm.milestoneHint')}
        placeholder={t('goalForm.milestonePlaceholder')}
        validate={(value) => (value ? null : t('goalForm.milestoneRequired'))}
        onSubmit={(title) => {
          if (milestoneGoalId) addMilestone(milestoneGoalId, title);
          setMilestoneGoalId(null);
        }}
        onCancel={() => setMilestoneGoalId(null)}
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
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.lg,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { ...type.titleLg, color: colors.onSurface },
    summaryLabel: { ...type.bodySm, color: colors.onSurfaceVariant },
    summaryDivider: { width: 1, height: 30, backgroundColor: colors.outlineVariant },
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
    countBadgeActive: { backgroundColor: colors.primaryContainer },
    countText: { ...type.labelSm, color: colors.onSurfaceVariant },
    countTextActive: { color: colors.onPrimaryContainer },
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
      backgroundColor: colors.primaryContainer,
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
      backgroundColor: colors.primary,
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      marginTop: SPACING.lg,
    },
    emptyActionText: { ...type.labelLg, color: colors.onPrimary },
    goalList: { gap: SPACING.md },
    goalCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
    },
    cardTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    priorityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.secondaryContainer,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    priorityPillImportant: { backgroundColor: colors.flameContainer },
    priorityDot: { width: 7, height: 7, borderRadius: 4 },
    priorityText: { ...type.labelSm, color: colors.onSecondaryContainer },
    menuButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalTitle: { ...type.titleLg, color: colors.onSurface },
    goalTitleDone: { color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
    deadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 4,
      marginBottom: SPACING.md,
    },
    deadlineText: { ...type.bodySm, color: colors.onSurfaceVariant },
    remainingText: {
      ...type.labelSm,
      color: colors.flame,
      marginLeft: 'auto',
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    progressLabel: { ...type.bodySm, color: colors.onSurfaceVariant },
    progressValue: { ...type.labelSm, color: colors.primary },
    progressTrack: {
      height: 7,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceContainerHighest,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radius.full },
    milestoneSummary: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
      paddingTop: SPACING.sm,
    },
    milestoneSummaryCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
    milestoneSummaryText: { ...type.bodySm, color: colors.onSurfaceVariant, flex: 1 },
    milestoneList: {
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.md,
      padding: SPACING.sm,
    },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 36 },
    milestoneText: { ...type.bodyMd, color: colors.onSurface, flex: 1 },
    milestoneDone: { color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
    addMilestone: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
    addMilestoneText: { ...type.labelMd, color: colors.primary },
  });
};
