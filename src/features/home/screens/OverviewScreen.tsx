import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import { Skeleton } from '@/shared/ui/Skeleton';
import {
  buildUnifiedTimeline,
  loadCachedGoogleEvents,
} from '@/features/calendar/services/googleSync';
import type { GoogleEvent, TimelineItem } from '@/shared/types/models';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';
import { localDateKey } from '@/shared/domain/productivity/homeStorage';
import type { RootStackNavigationProp } from '@/application/navigation/types';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';

const originPresentation = (
  item: TimelineItem,
): { label: string; icon: keyof typeof Ionicons.glyphMap } => {
  if (item.origin === 'habit') return { label: 'Hábito', icon: 'repeat' };
  if (item.origin === 'goal') return { label: 'Meta', icon: 'flag-outline' };
  return { label: 'Calendario', icon: 'calendar-outline' };
};

export const OverviewScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigation = useNavigation<RootStackNavigationProp>();
  const celebrate = useCelebrationStore((s) => s.trigger);

  const stateLoaded = useHomeStore((s) => s.stateLoaded);
  const goals = useHomeStore((s) => s.goals);
  const habits = useHomeStore((s) => s.habits);
  const streak = useHomeStore((s) => s.streak);
  const totalXp = useHomeStore((s) => s.totalXp);
  const toggleHabit = useHomeStore((s) => s.toggleHabit);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);

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
        celebrate({ kind: 'habit', subtitle: `+5 XP · ${item.title}` });
      }
    } else if (item.origin === 'goal') {
      toggleGoal(item.originalId);
      if (!item.completed) {
        celebrate({ kind: 'goal', subtitle: '+10 XP · Meta completada' });
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

  const formattedToday = new Date(`${todayKey}T00:00:00`).toLocaleDateString(
    'es-ES',
    { weekday: 'long', day: 'numeric', month: 'long' },
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>HOY</Text>
        <Text style={styles.title}>{formattedToday}</Text>
        <Text style={styles.subtitle}>Avanza a tu ritmo, sin perder el rumbo.</Text>
      </View>

      <View style={styles.focusCard}>
        {nextItem ? (
          <>
            <View style={styles.focusTopRow}>
              <View style={styles.focusLabel}>
                <View style={styles.pulseDot} />
                <Text style={styles.focusEyebrow}>SIGUIENTE</Text>
              </View>
              <Text style={styles.focusTime}>{nextItem.time ?? 'Todo el día'}</Text>
            </View>
            <Text style={styles.focusTitle} numberOfLines={2}>
              {nextItem.title.replace(/^ENTREGA:\s*/, '')}
            </Text>
            <View style={styles.focusFooter}>
              <View style={styles.originRow}>
                <Ionicons
                  name={originPresentation(nextItem).icon}
                  size={15}
                  color={colors.onPrimaryContainer}
                />
                <Text style={styles.focusOrigin}>{originPresentation(nextItem).label}</Text>
              </View>
              {nextItem.origin !== 'google_calendar' ? (
                <TouchableOpacity
                  style={styles.focusAction}
                  onPress={() => handleToggleItem(nextItem)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Marcar ${nextItem.title} como completado`}
                >
                  <Ionicons name="checkmark" size={17} color={colors.onFlame} />
                  <Text style={styles.focusActionText}>Listo</Text>
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
              <Text style={styles.clearTitle}>Tu día está despejado</Text>
              <Text style={styles.clearText}>Puedes descansar o preparar algo con calma.</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.progressCard}
        onPress={() => navigation.navigate('Progress')}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel={`Ver progreso completo, ${progress}% hoy`}
        accessibilityHint="Abre las estadísticas, nivel y logros"
      >
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressLabel}>Progreso del día</Text>
            <Text style={styles.progressCount}>
              {actionableItems.length
                ? `${completedCount} de ${actionableItems.length} completadas`
                : 'Sin pendientes para hoy'}
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
            <Text style={styles.statLabel}>días de racha</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="sparkles" size={15} color={colors.primary} />
            <Text style={styles.statValue}>{totalXp}</Text>
            <Text style={styles.statLabel}>XP acumulados</Text>
          </View>
        </View>
        <View style={styles.progressLink}>
          <Text style={styles.progressLinkText}>Ver progreso</Text>
          <Ionicons name="chevron-forward" size={17} color={colors.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tu agenda</Text>
        <Text style={styles.sectionMeta}>
          {timelineItems.length} {timelineItems.length === 1 ? 'actividad' : 'actividades'}
        </Text>
      </View>

      <View style={styles.timelineList}>
        {timelineItems.length === 0 ? (
          <View style={styles.emptyDayBox}>
            <SuiDoodle variant="sprout" size={62} color={colors.secondary} />
            <Text style={styles.emptyDayText}>No tienes actividades programadas para hoy.</Text>
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
                        item.origin === 'habit'
                          ? colors.flameContainer
                          : colors.primaryContainer,
                    },
                  ]}
                >
                  <Ionicons name={presentation.icon} size={17} color={accent} />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.itemMetaRow}>
                    <Text style={styles.itemTime}>{item.time ?? 'Todo el día'}</Text>
                    <Text style={styles.itemOrigin}>{presentation.label}</Text>
                  </View>
                  <Text
                    style={[styles.itemTitle, item.completed && !isGoogle && styles.itemDone]}
                    numberOfLines={2}
                  >
                    {item.title.replace(/^ENTREGA:\s*/, '')}
                  </Text>
                  {item.linkedGoalTitle ? (
                    <Text style={styles.itemLink} numberOfLines={1}>
                      Vinculado a {item.linkedGoalTitle}
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
                    accessibilityLabel={item.title}
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
