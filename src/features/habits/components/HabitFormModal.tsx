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
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import type { DayOfWeek, Goal } from '@/shared/types/models';
import { useI18n } from '@/shared/i18n/i18n';

type HabitDraft = {
  title: string;
  frequency: 'daily' | DayOfWeek[];
  linkedGoalId: string | null;
};

type Props = {
  visible: boolean;
  goals: Goal[];
  onSubmit: (draft: HabitDraft) => void;
  onCancel: () => void;
};

const WEEKDAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const HabitFormModal = ({ visible, goals, onSubmit, onCancel }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays'>('daily');
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setFrequency('daily');
      setLinkedGoalId(null);
      setError(null);
    }
  }, [visible]);

  const submit = () => {
    const value = title.trim();
    if (!value) {
      setError(t('habitForm.required'));
      return;
    }
    onSubmit({
      title: value,
      frequency: frequency === 'daily' ? 'daily' : WEEKDAYS,
      linkedGoalId,
    });
  };

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
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('habitForm.title')}</Text>
              <Text style={styles.subtitle}>{t('habitForm.subtitle')}</Text>
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
            <Text style={styles.fieldLabel}>{t('habitForm.question')}</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              placeholder={t('habitForm.placeholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={t('habitForm.nameLabel')}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.fieldLabel}>{t('habitForm.frequency')}</Text>
            <View style={styles.frequencyRow}>
              <TouchableOpacity
                style={[styles.frequencyOption, frequency === 'daily' && styles.optionSelected]}
                onPress={() => setFrequency('daily')}
                accessibilityRole="radio"
                accessibilityState={{ selected: frequency === 'daily' }}
              >
                <Ionicons
                  name="sunny-outline"
                  size={18}
                  color={frequency === 'daily' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text
                  style={[styles.optionText, frequency === 'daily' && styles.optionTextSelected]}
                >
                  {t('habits.everyDay')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.frequencyOption, frequency === 'weekdays' && styles.optionSelected]}
                onPress={() => setFrequency('weekdays')}
                accessibilityRole="radio"
                accessibilityState={{ selected: frequency === 'weekdays' }}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={18}
                  color={frequency === 'weekdays' ? colors.primary : colors.onSurfaceVariant}
                />
                <Text
                  style={[styles.optionText, frequency === 'weekdays' && styles.optionTextSelected]}
                >
                  {t('habitForm.weekdays')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.linkHeading}>
              <Text style={styles.fieldLabel}>{t('habitForm.linkGoal')}</Text>
              <Text style={styles.optional}>{t('habitForm.optional')}</Text>
            </View>
            <Text style={styles.linkHint}>{t('habitForm.linkHint')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.goalOptions}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.goalOption, linkedGoalId === null && styles.optionSelected]}
                onPress={() => setLinkedGoalId(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: linkedGoalId === null }}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={17}
                  color={linkedGoalId === null ? colors.primary : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.goalOptionText,
                    linkedGoalId === null && styles.optionTextSelected,
                  ]}
                >
                  {t('habitForm.unlinked')}
                </Text>
              </TouchableOpacity>
              {goals
                .filter((goal) => !goal.completed)
                .map((goal) => {
                  const selected = linkedGoalId === goal.id;
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      style={[styles.goalOption, selected && styles.optionSelected]}
                      onPress={() => setLinkedGoalId(goal.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Ionicons
                        name="flag-outline"
                        size={17}
                        color={selected ? colors.primary : colors.onSurfaceVariant}
                      />
                      <Text
                        style={[styles.goalOptionText, selected && styles.optionTextSelected]}
                        numberOfLines={1}
                      >
                        {goal.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </ScrollView>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submit}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t('habitForm.submit')}
          >
            <Text style={styles.submitText}>{t('habitForm.submit')}</Text>
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
      marginBottom: SPACING.lg,
    },
    headerCopy: { flex: 1 },
    title: { ...type.headlineSm, color: colors.onSurface },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
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
      color: colors.onSurface,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: SPACING.md,
    },
    inputError: { borderColor: colors.error },
    error: { ...type.bodySm, color: colors.error, marginTop: SPACING.xs },
    frequencyRow: { flexDirection: 'row', gap: SPACING.sm },
    frequencyOption: {
      flex: 1,
      minHeight: 64,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant, textAlign: 'center' },
    optionTextSelected: { color: colors.onPrimaryContainer },
    linkHeading: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: SPACING.sm,
    },
    optional: { ...type.bodySm, color: colors.onSurfaceVariant },
    linkHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: -SPACING.xs },
    goalOptions: { gap: SPACING.sm, paddingVertical: SPACING.md, paddingRight: SPACING.lg },
    goalOption: {
      maxWidth: 210,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: SPACING.md,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    goalOptionText: { ...type.labelMd, color: colors.onSurfaceVariant, maxWidth: 165 },
    submitButton: {
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    submitText: { ...type.labelLg, color: colors.onPrimary },
  });
};
