import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { Ionicons } from '@/shared/ui/Ionicons';
import type { PlanStep } from '../model/dayPlan';

export interface TodayPlanCardProps {
  /** Pasos tal como salen de `buildDayPlan`: el orden y el tope ya vienen resueltos. */
  steps: PlanStep[];
  onFocus: (step: PlanStep) => void;
  onOpen: (step: PlanStep) => void;
  onCreateGoal: () => void;
  onFreeFocus: () => void;
}

// Las razones con fecha se resaltan para que vencimientos cercanos no se
// pierdan entre el resto del contexto; el resto va como texto secundario.
const DEADLINE_REASONS = new Set<TranslationKey>([
  'home.plan.reason.overdue',
  'home.plan.reason.dueToday',
  'home.plan.reason.dueTomorrow',
  'home.plan.reason.dueSoon',
]);

const originOf = (
  step: PlanStep,
): { labelKey: TranslationKey; icon: 'flag-outline' | 'repeat' | 'git-commit-outline' } => {
  if (step.target.kind === 'habit') return { labelKey: 'home.habit', icon: 'repeat' };
  if (step.target.kind === 'milestone' && step.parentTitle) {
    return { labelKey: 'home.plan.origin.milestone', icon: 'git-commit-outline' };
  }
  return { labelKey: 'home.goal', icon: 'flag-outline' };
};

export const TodayPlanCard = ({
  steps,
  onFocus,
  onOpen,
  onCreateGoal,
  onFreeFocus,
}: TodayPlanCardProps) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();

  if (steps.length === 0) {
    return (
      <View style={styles.card} testID="today-plan-empty">
        <View style={styles.header}>
          <View style={styles.headerLabel}>
            <View style={styles.pulseDot} />
            <Text style={styles.eyebrow}>{t('home.plan.title')}</Text>
          </View>
        </View>
        <Text style={styles.emptyTitle}>{t('home.plan.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('home.plan.emptyBody')}</Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.focusButton}
            onPress={onCreateGoal}
            accessibilityRole="button"
            accessibilityLabel={t('home.plan.emptyGoal')}
          >
            <Ionicons name="flag-outline" size={17} color={colors.onFlame} />
            <Text style={styles.focusButtonText}>{t('home.plan.emptyGoal')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onFreeFocus}
            accessibilityRole="button"
            accessibilityLabel={t('home.plan.emptyFocus')}
          >
            <Ionicons name="timer-outline" size={17} color={colors.onPrimaryContainer} />
            <Text style={styles.secondaryButtonText}>{t('home.plan.emptyFocus')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [first, ...rest] = steps as [PlanStep, ...PlanStep[]];

  const renderMeta = (step: PlanStep) => {
    const origin = originOf(step);
    const isDeadline = DEADLINE_REASONS.has(step.reasonKey);
    return (
      <View style={styles.metaRow}>
        <View style={styles.origin}>
          <Ionicons name={origin.icon} size={14} color={colors.onPrimaryContainer} />
          <Text style={styles.originText} numberOfLines={1}>
            {step.parentTitle
              ? t(origin.labelKey, { title: step.parentTitle })
              : t(origin.labelKey)}
          </Text>
        </View>
        <Text
          style={isDeadline ? styles.deadlineChip : styles.reasonText}
          numberOfLines={1}
          testID={`today-plan-reason-${step.id}`}
        >
          {t(step.reasonKey, step.reasonParams)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card} testID="today-plan">
      <View style={styles.header}>
        <View style={styles.headerLabel}>
          <View style={styles.pulseDot} />
          <Text style={styles.eyebrow}>{t('home.plan.title')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('home.plan.subtitle')}</Text>
      </View>

      <View testID="today-plan-step" style={styles.firstStep}>
        <TouchableOpacity onPress={() => onOpen(first)} accessibilityRole="button">
          <Text style={styles.firstTitle} numberOfLines={2}>
            {first.title}
          </Text>
        </TouchableOpacity>
        {renderMeta(first)}
        <View style={styles.focusRow}>
          <TouchableOpacity
            style={styles.focusButton}
            onPress={() => onFocus(first)}
            accessibilityRole="button"
            accessibilityLabel={t('home.plan.focusA11y', {
              title: first.title,
              minutes: first.blockMinutes,
            })}
            testID="today-plan-focus"
          >
            <Ionicons name="play" size={16} color={colors.onFlame} />
            <Text style={styles.focusButtonText}>{t('home.plan.focus')}</Text>
          </TouchableOpacity>
          <Text style={styles.blockText}>
            {t('home.plan.minutes', { minutes: first.blockMinutes })}
          </Text>
        </View>
      </View>

      {rest.map((step, index) => (
        <View key={step.id} testID="today-plan-step" style={styles.restStep}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{index + 2}</Text>
          </View>
          <TouchableOpacity
            style={styles.restCopy}
            onPress={() => onOpen(step)}
            accessibilityRole="button"
          >
            <Text style={styles.restTitle} numberOfLines={2}>
              {step.title}
            </Text>
            {renderMeta(step)}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.primaryContainer,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
    },
    header: { marginBottom: SPACING.sm },
    headerLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.flame },
    eyebrow: {
      ...type.labelSm,
      color: colors.onPrimaryContainer,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    subtitle: {
      ...type.bodySm,
      color: colors.onPrimaryContainer,
      opacity: 0.72,
      marginTop: 2,
    },
    firstStep: { paddingTop: SPACING.xs },
    firstTitle: { ...type.titleLg, color: colors.onPrimaryContainer, marginBottom: SPACING.xs },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: 2,
    },
    origin: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
    originText: { ...type.bodySm, color: colors.onPrimaryContainer, flexShrink: 1 },
    reasonText: { ...type.bodySm, color: colors.onPrimaryContainer, opacity: 0.72 },
    deadlineChip: {
      ...type.labelSm,
      color: colors.onFlameContainer,
      backgroundColor: colors.flameContainer,
      borderRadius: radius.full,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    focusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.md,
    },
    focusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.flame,
      borderRadius: radius.full,
      paddingHorizontal: SPACING.lg,
      minHeight: 44,
    },
    focusButtonText: { ...type.labelLg, color: colors.onFlame },
    blockText: { ...type.labelMd, color: colors.onPrimaryContainer, opacity: 0.72 },
    restStep: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
    },
    stepNumber: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNumberText: { ...type.labelMd, color: colors.primary },
    restCopy: { flex: 1, minWidth: 0, minHeight: 44 },
    restTitle: { ...type.titleSm, color: colors.onPrimaryContainer },
    emptyTitle: { ...type.titleMd, color: colors.onPrimaryContainer, marginTop: SPACING.xs },
    emptyBody: {
      ...type.bodySm,
      color: colors.onPrimaryContainer,
      opacity: 0.8,
      marginTop: 2,
    },
    emptyActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingHorizontal: SPACING.lg,
      minHeight: 44,
    },
    secondaryButtonText: { ...type.labelLg, color: colors.onPrimaryContainer },
  });
