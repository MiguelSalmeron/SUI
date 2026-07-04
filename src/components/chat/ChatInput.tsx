import React, { useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { MAX_INPUT_CHARS } from '../../types/chat';

interface Props {
  /** true mientras el asistente responde: bloquea el envío. */
  busy: boolean;
  onSend: (text: string) => void;
}

export const ChatInput = ({ busy, onSend }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText('');
  };

  const disabled = busy || text.trim().length === 0;

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.input}
        placeholder="Escribe lo que sientes…"
        placeholderTextColor={colors.onSurfaceVariant}
        value={text}
        onChangeText={setText}
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
        accessibilityLabel="Enviar mensaje"
        accessibilityState={{ disabled }}
      >
        <Text style={styles.sendText}>↑</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
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
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 20,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
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
    backgroundColor: colors.primaryContainer,
  },
  sendText: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
});
