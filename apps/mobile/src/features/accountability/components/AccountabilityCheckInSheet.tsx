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
import { MAX_NOTE_LENGTH } from '../model/accountabilityTypes';
import { validateNote } from '../model/accountabilityValidation';

/**
 * Respuestas de check-in (plan §7.3/§8.2). Cada una mapea a un evento del
 * ciclo y una acción opcional del store; la máquina de estados decide si es
 * válida desde el estado actual.
 */
export type CheckInDecision = 'completed' | 'in_progress' | 'minimum' | 'reschedule' | 'pause';

export type CheckInResolution =
  | { decision: 'completed' }
  | { decision: 'in_progress' }
  | { decision: 'minimum' }
  | { decision: 'reschedule'; date: string; time: string }
  | { decision: 'pause' };

type Props = {
  visible: boolean;
  subjectTitle: string;
  nextAction: string;
  minimumAction?: string;
  onClose: () => void;
  onResolve: (resolution: CheckInResolution, note: string) => void;
};

export const isUsableNote = (value: string): boolean =>
  validateNote(value) && value.trim().length > 0;

export const AccountabilityCheckInSheet = ({
  visible,
  subjectTitle,
  nextAction,
  minimumAction,
  onClose,
  onResolve,
}: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setNote('');
    setRescheduleOpen(false);
    setRescheduleDate('');
    setRescheduleTime('');
    setError(null);
  }, [visible]);

  const options: {
    decision: CheckInDecision;
    icon: string;
    label: string;
    body: string;
    tone?: 'primary' | 'neutral';
  }[] = [
    {
      decision: 'completed',
      icon: 'checkmark-circle-outline',
      label: t('accountability.checkIn.done'),
      body: t('accountability.checkIn.doneBody'),
      tone: 'primary',
    },
    {
      decision: 'in_progress',
      icon: 'play-circle-outline',
      label: t('accountability.checkIn.inProgress'),
      body: t('accountability.checkIn.inProgressBody'),
    },
    ...(minimumAction
      ? [
          {
            decision: 'minimum' as const,
            icon: 'download-outline',
            label: t('accountability.checkIn.minimum'),
            body: t('accountability.checkIn.minimumBody', { action: minimumAction }),
          },
        ]
      : []),
    {
      decision: 'reschedule',
      icon: 'calendar-outline',
      label: t('accountability.checkIn.reschedule'),
      body: t('accountability.checkIn.rescheduleBody'),
    },
    {
      decision: 'pause',
      icon: 'pause-circle-outline',
      label: t('accountability.checkIn.pause'),
      body: t('accountability.checkIn.pauseBody'),
    },
  ];

  const resolve = (decision: CheckInDecision) => {
    if (decision === 'reschedule') {
      if (!rescheduleOpen) {
        setRescheduleOpen(true);
        return;
      }
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate);
      const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(rescheduleTime);
      if (!validDate || !validTime) {
        setError(t('accountability.checkIn.errorReschedule'));
        return;
      }
      onResolve({ decision, date: rescheduleDate, time: rescheduleTime }, note.trim());
      return;
    }
    onResolve({ decision } as CheckInResolution, note.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
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
                {t('accountability.checkIn.title')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {subjectTitle}
              </Text>
              <Text style={styles.action}>{nextAction}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.decision}
                style={styles.option}
                onPress={() => resolve(option.decision)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <Ionicons
                  name={option.icon as never}
                  size={22}
                  color={option.tone === 'primary' ? colors.primary : colors.onSurfaceVariant}
                />
                <View style={styles.optionCopy}>
                  <Text
                    style={[
                      styles.optionLabel,
                      option.tone === 'primary' && { color: colors.primary },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.optionBody} numberOfLines={2}>
                    {option.body}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="assertive">
                {error}
              </Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t('accountability.checkIn.noteLabel')}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={t('accountability.checkIn.notePlaceholder')}
              placeholderTextColor={colors.onSurfaceVariant}
              multiline
              maxLength={MAX_NOTE_LENGTH}
              accessibilityLabel={t('accountability.checkIn.noteLabel')}
            />
            <Text style={styles.noteHint}>{t('accountability.checkIn.noteHint')}</Text>

            {rescheduleOpen ? (
              <View style={styles.rescheduleBox}>
                <Text style={styles.fieldLabel}>{t('accountability.checkIn.rescheduleDate')}</Text>
                <TextInput
                  style={styles.noteInput}
                  value={rescheduleDate}
                  onChangeText={(value) => {
                    setRescheduleDate(value);
                    setError(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.onSurfaceVariant}
                  maxLength={10}
                  accessibilityLabel={t('accountability.checkIn.rescheduleDate')}
                />
                <Text style={styles.fieldLabel}>{t('accountability.checkIn.rescheduleTime')}</Text>
                <TextInput
                  style={styles.noteInput}
                  value={rescheduleTime}
                  onChangeText={(value) => {
                    setRescheduleTime(value);
                    setError(null);
                  }}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.onSurfaceVariant}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  accessibilityLabel={t('accountability.checkIn.rescheduleTime')}
                />
                <TouchableOpacity
                  style={styles.rescheduleConfirm}
                  onPress={() => resolve('reschedule')}
                  accessibilityRole="button"
                  accessibilityLabel={t('accountability.checkIn.rescheduleConfirm')}
                >
                  <Text style={styles.rescheduleConfirmText}>
                    {t('accountability.checkIn.rescheduleConfirm')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
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
      maxHeight: '88%',
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
    action: { ...type.labelLg, color: colors.primary, marginTop: SPACING.xs },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: 64,
      paddingVertical: SPACING.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    optionCopy: { flex: 1 },
    optionLabel: { ...type.labelLg, color: colors.onSurface },
    optionBody: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    error: { ...type.bodySm, color: colors.error, marginTop: SPACING.sm },
    fieldLabel: {
      ...type.labelLg,
      color: colors.onSurface,
      marginBottom: SPACING.sm,
      marginTop: SPACING.md,
    },
    noteInput: {
      ...type.bodyMd,
      minHeight: 72,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      color: colors.onSurface,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      textAlignVertical: 'top',
    },
    noteHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: SPACING.xs },
    rescheduleBox: {
      marginTop: SPACING.sm,
      padding: SPACING.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceContainerLow,
    },
    rescheduleConfirm: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.sm,
    },
    rescheduleConfirmText: { ...type.labelLg, color: colors.onPrimary },
  });
};
