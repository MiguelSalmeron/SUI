import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import {
  useFocusEffect,
  useNavigation,
  type CompositeNavigationProp,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { SCREEN_CONTENT_BOTTOM_PADDING, SPACING, useAppTheme } from '@/shared/theme/theme';
import { Skeleton } from '@/shared/ui/Skeleton';
import { buildUnifiedTimeline, loadCachedGoogleEvents } from '@/features/calendar/public';
import type { GoogleEvent, TimelineItem } from '@/shared/types/models';
import {
  localDateKey,
  useCelebrationStore,
  useProductivityStore,
} from '@/shared/domain/productivity/public';
import type { MainTabParamList, RootStackParamList } from '@/shared/navigation/types';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';

type OverviewNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Overview'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const originPresentation = (
  item: TimelineItem,
): { labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap } => {
  if (item.origin === 'habit') return { labelKey: 'home.habit', icon: 'repeat' };
  if (item.origin === 'goal') return { labelKey: 'home.goal', icon: 'flag-outline' };
  return { labelKey: 'home.calendar', icon: 'calendar-outline' };
};

export const OverviewScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<OverviewNavigation>();
  const { t, formatDate } = useI18n();
  const celebrate = useCelebrationStore((s) => s.trigger);

  const stateLoaded = useProductivityStore((s) => s.stateLoaded);
  const goals = useProductivityStore((s) => s.goals);
  const habits = useProductivityStore((s) => s.habits);
  const streak = useProductivityStore((s) => s.streak);
  const totalXp = useProductivityStore((s) => s.totalXp);
  const toggleHabit = useProductivityStore((s) => s.toggleHabit);
  const toggleGoal = useProductivityStore((s) => s.toggleGoal);

  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const todayKey = localDateKey();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadCachedGoogleEvents()
        .then((events) => {
          if (active) setGoogleEvents(events);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, []),
  );

  const timelineItems = useMemo(
    () => buildUnifiedTimeline(todayKey, googleEvents, goals, habits),
    [todayKey, googleEvents, goals, habits],
  );
  const actionableItems = useMemo(
    () => timelineItems.filter((item) => item.origin !== 'google_calendar'),
    [timelineItems],
  );
  const completedCount = actionableItems.filter((item) => item.completed).length;
  const progress = actionableItems.length
    ? Math.round((completedCount / actionableItems.length) * 100)
    : 0;
  const nextItem = timelineItems.find((item) => {
    if (item.origin !== 'google_calendar') return !item.completed;
    if (!item.startAt) return true;
    return new Date(item.startAt).getTime() >= Date.now();
  });

  const handleToggleItem = (item: TimelineItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (item.origin === 'habit') {
      toggleHabit(item.originalId);
      if (!item.completed) {
        celebrate({ kind: 'habit', subtitle: t('celebration.habitXp', { title: item.title }) });
      }
    } else if (item.origin === 'goal') {
      toggleGoal(item.originalId);
      if (!item.completed) {
        celebrate({ kind: 'goal', subtitle: t('home.goalCompleted') });
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
        <Skeleton height={58} radius="lg" />
        <Skeleton height={170} radius="xl" />
        <Skeleton height={92} radius="lg" />
        <Skeleton height={220} radius="lg" />
      </ScrollView>
    );
  }

  const formattedToday = formatDate(new Date(`${todayKey}T00:00:00`), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{t('home.today')}</Text>
        <Text style={styles.title}>{formattedToday}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </View>

      {goals.length === 0 && habits.length === 0 ? (
        <View style={styles.firstRunCard}>
          <SuiDoodle variant="sprout" size={72} color={colors.primary} />
          <Text style={styles.firstRunTitle}>{t('home.emptyTitle')}</Text>
          <Text style={styles.firstRunBody}>{t('home.emptyBody')}</Text>
          <View style={styles.firstRunActions}>
            <TouchableOpacity
              style={styles.firstRunPrimary}
              onPress={() => navigation.navigate('Goals', { create: true })}
            >
              <Ionicons name="flag-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.firstRunPrimaryText}>{t('home.firstGoal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.firstRunSecondary}
              onPress={() => navigation.navigate('Habits', { create: true })}
            >
              <Ionicons name="repeat" size={18} color={colors.secondary} />
              <Text style={styles.firstRunSecondaryText}>{t('home.firstHabit')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.focusCard}>
        {nextItem ? (
          <>
            <View style={styles.focusTopRow}>
              <View style={styles.focusLabel}>
                <View style={styles.pulseDot} />
                <Text style={styles.focusEyebrow}>{t('home.next')}</Text>
              </View>
              <Text style={styles.focusTime}>{nextItem.time ?? t('home.allDay')}</Text>
            </View>
            <Text style={styles.focusTitle} numberOfLines={2}>
              {nextItem.title || t('calendar.untitledEvent')}
            </Text>
            <View style={styles.focusFooter}>
              <View style={styles.originRow}>
                <Ionicons
                  name={originPresentation(nextItem).icon}
                  size={15}
                  color={colors.onPrimaryContainer}
                />
                <Text style={styles.focusOrigin}>{t(originPresentation(nextItem).labelKey)}</Text>
              </View>
              {nextItem.origin !== 'google_calendar' ? (
                <TouchableOpacity
                  style={styles.focusAction}
                  onPress={() => handleToggleItem(nextItem)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={t('home.markDone', {
                    title: nextItem.title || t('calendar.untitledEvent'),
                  })}
                >
                  <Ionicons name="checkmark" size={17} color={colors.onFlame} />
                  <Text style={styles.focusActionText}>{t('home.done')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.clearDay}>
            <View style={styles.clearIcon}>
              <Ionicons name="checkmark" size={24} color={colors.onSecondaryContainer} />
            </View>
            <View style={styles.clearCopy}>
              <Text style={styles.clearTitle}>{t('home.clearTitle')}</Text>
              <Text style={styles.clearText}>{t('home.clearBody')}</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.progressCard}
        onPress={() => navigation.navigate('Progress')}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={t('home.progressAccessibility', { progress })}
        accessibilityHint={t('home.progressHint')}
      >
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressLabel}>{t('home.dailyProgress')}</Text>
            <Text style={styles.progressCount}>
              {actionableItems.length
                ? t('home.completedCount', { done: completedCount, total: actionableItems.length })
                : t('home.noPending')}
            </Text>
          </View>
          <Text style={styles.progressPercent}>{progress}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={16} color={colors.flame} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>{t('home.streakDays')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="sparkles" size={15} color={colors.primary} />
            <Text style={styles.statValue}>{totalXp}</Text>
            <Text style={styles.statLabel}>{t('home.totalXp')}</Text>
          </View>
        </View>
        <View style={styles.progressLink}>
          <Text style={styles.progressLinkText}>{t('home.viewProgress')}</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('home.agenda')}</Text>
        <Text style={styles.sectionMeta}>
          {timelineItems.length}{' '}
          {timelineItems.length === 1 ? t('calendar.activity') : t('calendar.activities')}
        </Text>
      </View>

      <View style={styles.timelineList}>
        {timelineItems.length === 0 ? (
          <View style={styles.emptyDayBox}>
            <SuiDoodle variant="sprout" size={62} color={colors.secondary} />
            <Text style={styles.emptyDayText}>{t('home.emptyAgenda')}</Text>
          </View>
        ) : (
          timelineItems.map((item) => {
            const presentation = originPresentation(item);
            const isGoogle = item.origin === 'google_calendar';
            const accent = item.origin === 'habit' ? colors.flame : colors.primary;

            return (
              <View key={item.id} style={styles.timelineRow}>
                <View
                  style={[
                    styles.itemIcon,
                    {
                      backgroundColor:
                        item.origin === 'habit' ? colors.flameContainer : colors.primaryContainer,
                    },
                  ]}
                >
                  <Ionicons name={presentation.icon} size={17} color={accent} />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemTime}>{item.time ?? t('home.allDay')}</Text>
                    <Text style={styles.itemOrigin}>{t(presentation.labelKey)}</Text>
                  </View>
                  <Text
                    style={[styles.itemTitle, item.completed && !isGoogle && styles.itemDone]}
                    numberOfLines={2}
                  >
                    {item.title || t('calendar.untitledEvent')}
                  </Text>
                  {item.linkedGoalTitle ? (
                    <Text style={styles.itemLink} numberOfLines={1}>
                      {t('home.linkedGoal', { title: item.linkedGoalTitle })}
                    </Text>
                  ) : null}
                </View>
                {!isGoogle ? (
                  <TouchableOpacity
                    style={[styles.checkButton, item.completed && styles.checkButtonDone]}
                    onPress={() => handleToggleItem(item)}
                    activeOpacity={0.75}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.completed }}
                    accessibilityLabel={item.title || t('calendar.untitledEvent')}
                  >
                    {item.completed ? (
                      <Ionicons name="checkmark" size={16} color={colors.onSuccess} />
                    ) : null}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </View>
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
    intro: { marginBottom: SPACING.lg },
    eyebrow: { ...type.labelSm, color: colors.primary, letterSpacing: 1.4 },
    title: {
      ...type.headlineSm,
      color: colors.onSurface,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
    firstRunCard: {
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    firstRunTitle: {
      ...type.titleLg,
      color: colors.onSurface,
      textAlign: 'center',
      marginTop: SPACING.sm,
    },
    firstRunBody: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    firstRunActions: { width: '100%', gap: SPACING.sm, marginTop: SPACING.lg },
    firstRunPrimary: {
      minHeight: 48,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    firstRunPrimaryText: { ...type.labelLg, color: colors.onPrimary },
    firstRunSecondary: {
      minHeight: 48,
      borderRadius: radius.full,
      backgroundColor: colors.secondaryContainer,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    firstRunSecondaryText: { ...type.labelLg, color: colors.onSecondaryContainer },
    focusCard: {
      minHeight: 158,
      backgroundColor: colors.primaryContainer,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    focusTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    focusLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.flame },
    focusEyebrow: {
      ...type.labelSm,
      color: colors.onPrimaryContainer,
      letterSpacing: 1.2,
    },
    focusTime: { ...type.labelMd, color: colors.onPrimaryContainer, opacity: 0.72 },
    focusTitle: {
      ...type.titleLg,
      color: colors.onPrimaryContainer,
      marginVertical: SPACING.md,
      maxWidth: 300,
    },
    focusFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    originRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    focusOrigin: { ...type.bodySm, color: colors.onPrimaryContainer },
    focusAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.flame,
      borderRadius: radius.full,
      paddingHorizontal: SPACING.md,
      minHeight: 40,
    },
    focusActionText: { ...type.labelLg, color: colors.onFlame },
    clearDay: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    clearIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearCopy: { flex: 1 },
    clearTitle: { ...type.titleMd, color: colors.onPrimaryContainer },
    clearText: {
      ...type.bodySm,
      color: colors.onPrimaryContainer,
      opacity: 0.75,
      marginTop: 2,
    },
    progressCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      padding: SPACING.md,
      marginBottom: SPACING.xl,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    progressLabel: { ...type.titleSm, color: colors.onSurface },
    progressCount: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    progressPercent: { ...type.titleLg, color: colors.primary },
    progressTrack: {
      height: 7,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceContainerHighest,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: colors.secondary,
    },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md },
    statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
    statValue: { ...type.labelLg, color: colors.onSurface },
    statLabel: { ...type.bodySm, color: colors.onSurfaceVariant },
    statDivider: {
      width: 1,
      height: 22,
      backgroundColor: colors.outlineVariant,
      marginHorizontal: SPACING.sm,
    },
    progressLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
    },
    progressLinkText: { ...type.labelMd, color: colors.primary },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    sectionTitle: { ...type.titleLg, color: colors.onSurface },
    sectionMeta: { ...type.bodySm, color: colors.onSurfaceVariant },
    timelineList: { gap: SPACING.sm },
    emptyDayBox: {
      minHeight: 104,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    emptyDayText: { ...type.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: SPACING.sm,
    },
    itemIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemCopy: { flex: 1, minWidth: 0 },
    itemMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: 2,
    },
    itemTime: { ...type.labelSm, color: colors.primary },
    itemOrigin: { ...type.bodySm, color: colors.onSurfaceVariant },
    itemTitle: { ...type.titleSm, color: colors.onSurface },
    itemDone: { color: colors.onSurfaceVariant, textDecorationLine: 'line-through' },
    itemLink: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
    checkButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkButtonDone: { backgroundColor: colors.success, borderColor: colors.success },
  });
};
