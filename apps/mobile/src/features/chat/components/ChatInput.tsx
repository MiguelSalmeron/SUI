import { useMemo, type RefObject } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { MAX_INPUT_CHARS } from '../types/chat';
import { useI18n } from '@/shared/i18n/i18n';

interface Props {
  /** true mientras el asistente responde: bloquea el envío. */
  busy: boolean;
  text: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  inputRef?: RefObject<TextInput | null>;
}

export const ChatInput = ({ busy, text, onChangeText, onSend, inputRef }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    onChangeText('');
  };

  const disabled = busy || text.trim().length === 0;

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={t('chat.inputPlaceholder')}
        placeholderTextColor={colors.onSurfaceVariant}
        value={text}
        onChangeText={onChangeText}
        maxLength={MAX_INPUT_CHARS}
        multiline
        editable={!busy}
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={submit}
      />
      <TouchableOpacity
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        onPress={submit}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('chat.send')}
        accessibilityState={{ disabled }}
      >
        <Ionicons
          name="arrow-up"
          size={22}
          color={disabled ? colors.onSurfaceVariant : colors.onPrimary}
        />
      </TouchableOpacity>
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      backgroundColor: colors.surface,
    },
    input: {
      ...type.bodyLg,
      flex: 1,
      maxHeight: 120,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 20,
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.md,
      color: colors.onSurface,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.surfaceContainerHighest,
    },
  });
