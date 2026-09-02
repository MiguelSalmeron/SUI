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
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import { localDateKey } from '@/shared/domain/productivity/public';
import type { Goal, GoalGravity } from '@/shared/types/models';
import { useI18n } from '@/shared/i18n/i18n';

type GoalDraft = {
  title: string;
  deadline: string;
  gravity: GoalGravity;
};

type Props = {
  visible: boolean;
  initialGoal?: Goal | null;
  onSubmit: (draft: GoalDraft) => void;
  onCancel: () => void;
};

const deadlineFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

export const GoalFormModal = ({ visible, initialGoal, onSubmit, onCancel }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, formatDate } = useI18n();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState(deadlineFromToday(7));
  const [gravity, setGravity] = useState<GoalGravity>('low');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initialGoal?.title ?? '');
      setDeadline(initialGoal?.deadline ?? deadlineFromToday(7));
      setGravity(initialGoal?.gravity ?? 'low');
      setError(null);
    }
  }, [initialGoal, visible]);

  const submit = () => {
    const value = title.trim();
    if (!value) {
      setError(t('goalForm.required'));
      return;
    }
    const parsed = new Date(`${deadline}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(parsed.getTime())) {
      setError(t('goalForm.invalidDate'));
      return;
    }
    if (!initialGoal && deadline < localDateKey()) {
      setError(t('goalForm.pastDate'));
      return;
    }
    onSubmit({ title: value, deadline, gravity });
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
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} accessibilityRole="header">
                {t(initialGoal ? 'goalForm.editTitle' : 'goalForm.title')}
              </Text>
              <Text style={styles.subtitle}>
                {t(initialGoal ? 'goalForm.editSubtitle' : 'goalForm.subtitle')}
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
            <Text style={styles.fieldLabel}>{t('goalForm.question')}</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              placeholder={t('goalForm.placeholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={t('goalForm.nameLabel')}
            />
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="assertive">
                {error}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t('goalForm.deadline')}</Text>
            <View style={styles.optionsRow}>
              {[7, 14, 28].map((days) => {
                const selected = deadline === deadlineFromToday(days);
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      setDeadline(deadlineFromToday(days));
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {days === 7
                        ? t('goalForm.oneWeek')
                        : days === 14
                          ? t('goalForm.twoWeeks')
                          : t('goalForm.fourWeeks')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.selectionHint}>
              {t('goalForm.due', {
                date: formatDate(new Date(`${deadline}T00:00:00`), {
                  day: 'numeric',
                  month: 'long',
                }),
              })}
            </Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.dateInput}
                value={deadline}
                onChangeText={(value) => {
                  setDeadline(value);
                  setError(null);
                }}
                placeholder="YYYY-MM-DD"
                accessibilityLabel={t('goalForm.exactDate')}
              />
            ) : (
              <View style={styles.datePicker}>
                <DateTimePicker
                  value={new Date(`${deadline}T12:00:00`)}
                  mode="date"
                  minimumDate={new Date(`${localDateKey()}T00:00:00`)}
                  onChange={(_, value) => {
                    if (!value) return;
                    setDeadline(localDateKey(value));
                    setError(null);
                  }}
                />
              </View>
            )}

            <Text style={styles.fieldLabel}>{t('goalForm.priority')}</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityOption, gravity === 'low' && styles.optionSelected]}
                onPress={() => setGravity('low')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gravity === 'low' }}
              >
                <Ionicons
                  name="leaf-outline"
                  size={18}
                  color={gravity === 'low' ? colors.primary : colors.onSurfaceVariant}
                />
                <View style={styles.priorityCopy}>
                  <Text
                    style={[styles.priorityTitle, gravity === 'low' && styles.optionTextSelected]}
                  >
                    {t('goals.normal')}
                  </Text>
                  <Text style={styles.priorityDescription}>{t('goalForm.normalBody')}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityOption, gravity === 'high' && styles.importantSelected]}
                onPress={() => setGravity('high')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gravity === 'high' }}
              >
                <Ionicons
                  name="flash-outline"
                  size={18}
                  color={gravity === 'high' ? colors.flame : colors.onSurfaceVariant}
                />
                <View style={styles.priorityCopy}>
                  <Text style={[styles.priorityTitle, gravity === 'high' && styles.importantText]}>
                    {t('goals.important')}
                  </Text>
                  <Text style={styles.priorityDescription}>{t('goalForm.importantBody')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submit}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={t(initialGoal ? 'goalForm.save' : 'goalForm.submit')}
          >
            <Text style={styles.submitText}>
              {t(initialGoal ? 'goalForm.save' : 'goalForm.submit')}
            </Text>
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
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.scrim,
    },
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
    optionsRow: { flexDirection: 'row', gap: SPACING.sm },
    option: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xs,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant, textAlign: 'center' },
    optionTextSelected: { color: colors.onPrimaryContainer },
    selectionHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: SPACING.xs },
    dateInput: {
      ...type.bodyMd,
      minHeight: 48,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.sm,
    },
    datePicker: { minHeight: 48, justifyContent: 'center', marginTop: SPACING.xs },
    priorityRow: { gap: SPACING.sm, marginBottom: SPACING.md },
    priorityOption: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    importantSelected: { borderColor: colors.flame, backgroundColor: colors.flameContainer },
    priorityCopy: { flex: 1 },
    priorityTitle: { ...type.titleSm, color: colors.onSurface },
    importantText: { color: colors.onFlameContainer },
    priorityDescription: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
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
