import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SCREEN_MAX_CONTENT_WIDTH, SPACING, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';
import {
  MAX_ACTION_TEXT_LENGTH,
  type AccountabilityCommitment,
  type AccountabilityIntensity,
  type EscalationPolicy,
  type ScheduleRule,
} from '../model/accountabilityTypes';
import { isValidTime, validateUserText } from '../model/accountabilityValidation';

export type SetupDraft = {
  nextAction: string;
  minimumAction?: string;
  durationMinutes?: number;
  time: string;
  intensity: AccountabilityIntensity;
  escalation: EscalationPolicy;
  schedule: ScheduleRule;
};

export type SetupDraftInput = {
  nextAction: string;
  minimumAction: string;
  durationMinutes: string;
  time: string;
  intensity: AccountabilityIntensity;
  escalation: EscalationPolicy;
  /** Días activos de la semana (sólo frecuencia semanal). */
  days: string[];
  /** Frecuencia elegida: diaria o días concretos. */
  frequency: 'daily' | 'weekly';
};

export type SetupDraftErrorKey =
  | 'accountability.setup.errorAction'
  | 'accountability.setup.errorTime'
  | 'accountability.setup.errorDays';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_KEYS)[number];

/**
 * Valida y construye el draft de seguimiento. Lógica pura testeable sin
 * render. La acción es obligatoria (es lo único que SUI recordará); la
 * versión mínima y la duración son opcionales (plan §8.1).
 */
export const buildSetupDraft = (
  input: SetupDraftInput,
): { draft: SetupDraft } | { errorKey: SetupDraftErrorKey } => {
  const nextAction = input.nextAction.trim();
  if (!validateUserText(nextAction, MAX_ACTION_TEXT_LENGTH)) {
    return { errorKey: 'accountability.setup.errorAction' };
  }
  if (!isValidTime(input.time)) return { errorKey: 'accountability.setup.errorTime' };
  if (input.frequency === 'weekly' && input.days.length === 0) {
    return { errorKey: 'accountability.setup.errorDays' };
  }
  const minimum = input.minimumAction.trim();
  const duration = Number.parseInt(input.durationMinutes, 10);
  const schedule: ScheduleRule =
    input.frequency === 'daily'
      ? { kind: 'daily', time: input.time }
      : {
          kind: 'weekly',
          days: input.days.filter((day): day is DayKey =>
            (DAY_KEYS as readonly string[]).includes(day),
          ),
          time: input.time,
        };
  return {
    draft: {
      nextAction,
      ...(minimum ? { minimumAction: minimum.slice(0, MAX_ACTION_TEXT_LENGTH) } : {}),
      ...(Number.isInteger(duration) && duration > 0 && duration <= 720
        ? { durationMinutes: duration }
        : {}),
      time: input.time,
      intensity: input.intensity,
      escalation: input.escalation,
      schedule,
    },
  };
};

type Props = {
  visible: boolean;
  subjectType: 'goal' | 'habit';
  subjectTitle: string;
  existing?: AccountabilityCommitment | null;
  onSubmit: (draft: SetupDraft) => void;
  onDisable?: () => void;
  onCancel: () => void;
};

export const AccountabilitySetupSheet = ({
  visible,
  subjectTitle,
  existing,
  onSubmit,
  onDisable,
  onCancel,
}: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const [nextAction, setNextAction] = useState('');
  const [minimumAction, setMinimumAction] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [time, setTime] = useState('19:00');
  const [intensity, setIntensity] = useState<AccountabilityIntensity>('firm');
  const [escalation, setEscalation] = useState<EscalationPolicy>('reschedule_or_minimum');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
  const [days, setDays] = useState<DayKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNextAction(existing?.nextAction ?? '');
    setMinimumAction(existing?.minimumAction ?? '');
    setDurationMinutes(existing?.durationMinutes ? String(existing.durationMinutes) : '');
    setTime(existing?.schedule.time ?? '19:00');
    setIntensity(existing?.intensity ?? 'firm');
    setEscalation(existing?.escalation ?? 'reschedule_or_minimum');
    setFrequency(existing?.schedule.kind === 'weekly' ? 'weekly' : 'daily');
    setDays(
      existing?.schedule.kind === 'weekly'
        ? existing.schedule.days.filter((day): day is DayKey => DAY_KEYS.includes(day as DayKey))
        : [],
    );
    setError(null);
  }, [existing, visible]);

  const toggleDay = (day: DayKey) => {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
    setError(null);
  };

  const submit = () => {
    const result = buildSetupDraft({
      nextAction,
      minimumAction,
      durationMinutes,
      time,
      intensity,
      escalation,
      frequency,
      days,
    });
    if ('errorKey' in result) {
      setError(t(result.errorKey));
      return;
    }
    onSubmit(result.draft);
  };

  const intensityOptions: {
    value: AccountabilityIntensity;
    icon: string;
    label: string;
    body: string;
  }[] = [
    {
      value: 'soft',
      icon: 'leaf-outline',
      label: t('accountability.intensity.soft'),
      body: t('accountability.intensity.softBody'),
    },
    {
      value: 'firm',
      icon: 'flag-outline',
      label: t('accountability.intensity.firm'),
      body: t('accountability.intensity.firmBody'),
    },
    {
      value: 'demanding',
      icon: 'flame-outline',
      label: t('accountability.intensity.demanding'),
      body: t('accountability.intensity.demandingBody'),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} accessibilityRole="header">
                {t('accountability.setup.title')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subjectTitle}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>{t('accountability.setup.actionLabel')}</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={nextAction}
              onChangeText={(value) => {
                setNextAction(value);
                setError(null);
              }}
              placeholder={t('accountability.setup.actionPlaceholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={MAX_ACTION_TEXT_LENGTH}
              returnKeyType="done"
              accessibilityLabel={t('accountability.setup.actionLabel')}
            />
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="assertive">
                {error}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t('accountability.setup.timeLabel')}</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="19:00"
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              returnKeyType="done"
              accessibilityLabel={t('accountability.setup.timeLabel')}
              accessibilityHint={t('accountability.setup.timeHint')}
            />

            <Text style={styles.fieldLabel}>{t('accountability.setup.frequencyLabel')}</Text>
            <View style={styles.optionsRow}>
              {(['daily', 'weekly'] as const).map((value) => {
                const selected = frequency === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => setFrequency(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {t(
                        value === 'daily'
                          ? 'accountability.frequency.daily'
                          : 'accountability.frequency.weekly',
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {frequency === 'weekly' ? (
              <View style={styles.daysRow}>
                {DAY_KEYS.map((day) => {
                  const selected = days.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayChip, selected && styles.dayChipSelected]}
                      onPress={() => toggleDay(day)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t(`accountability.day.${day}` as never)}
                    >
                      <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                        {t(`accountability.day.${day}` as never)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{t('accountability.setup.intensityLabel')}</Text>
            <View style={styles.intensityColumn}>
              {intensityOptions.map((option) => {
                const selected = intensity === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.intensityOption, selected && styles.optionSelected]}
                    onPress={() => setIntensity(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={option.icon as never}
                      size={18}
                      color={selected ? colors.primary : colors.onSurfaceVariant}
                    />
                    <View style={styles.priorityCopy}>
                      <Text style={[styles.intensityTitle, selected && styles.optionTextSelected]}>
                        {option.label}
                      </Text>
                      <Text style={styles.intensityBody}>{option.body}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>{t('accountability.setup.minimumLabel')}</Text>
            <TextInput
              style={styles.input}
              value={minimumAction}
              onChangeText={setMinimumAction}
              placeholder={t('accountability.setup.minimumPlaceholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={MAX_ACTION_TEXT_LENGTH}
              returnKeyType="done"
              accessibilityLabel={t('accountability.setup.minimumLabel')}
            />

            <Text style={styles.fieldLabel}>{t('accountability.setup.durationLabel')}</Text>
            <TextInput
              style={styles.input}
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              placeholder={t('accountability.setup.durationPlaceholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              keyboardType="number-pad"
              maxLength={3}
              returnKeyType="done"
              accessibilityLabel={t('accountability.setup.durationLabel')}
            />

            {onDisable && existing ? (
              <TouchableOpacity
                style={styles.disableButton}
                onPress={onDisable}
                accessibilityRole="button"
                accessibilityLabel={t('accountability.setup.disable')}
              >
                <Ionicons name="pause-circle-outline" size={18} color={colors.error} />
                <Text style={styles.disableText}>{t('accountability.setup.disable')}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submit}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t('accountability.setup.activate')}
          >
            <Text style={styles.submitText}>{t('accountability.setup.activate')}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
    sheet: {
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      alignSelf: 'center',
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    headerCopy: { flex: 1 },
    title: { ...type.headlineSm, color: colors.onSurface },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    fieldLabel: {
      ...type.labelLg,
      color: colors.onSurface,
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },
    input: {
      ...type.bodyLg,
      minHeight: 54,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      color: colors.onSurface,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
    },
    inputError: { borderColor: colors.error },
    error: { ...type.bodySm, color: colors.error, marginBottom: SPACING.sm },
    optionsRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
    option: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
    },
    optionSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant },
    optionTextSelected: { color: colors.onPrimaryContainer },
    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
    dayChip: {
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
    dayText: { ...type.labelMd, color: colors.onSurfaceVariant },
    dayTextSelected: { color: colors.onPrimaryContainer },
    intensityColumn: { gap: SPACING.xs, marginBottom: SPACING.sm },
    intensityOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    intensityTitle: { ...type.labelLg, color: colors.onSurface },
    intensityBody: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    priorityCopy: { flex: 1 },
    disableButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: 44,
      marginTop: SPACING.md,
      marginBottom: SPACING.sm,
    },
    disableText: { ...type.labelMd, color: colors.error },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: 54,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginTop: SPACING.sm,
    },
    submitText: { ...type.labelLg, color: colors.onPrimary },
  });
};
