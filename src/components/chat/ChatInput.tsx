import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';
import { MAX_INPUT_CHARS } from '../../types/chat';

interface Props {
  /** true mientras el asistente responde: bloquea el envío. */
  busy: boolean;
  onSend: (text: string) => void;
}

export const ChatInput = ({ busy, onSend }: Props) => {
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
        placeholderTextColor={MD3_COLORS.onSurfaceVariant}
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
      >
        <Text style={styles.sendText}>↑</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: MD3_COLORS.outlineVariant,
    backgroundColor: MD3_COLORS.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: MD3_COLORS.background,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    borderRadius: 20,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: MD3_COLORS.onSurface,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MD3_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: MD3_COLORS.primaryContainer,
  },
  sendText: {
    color: MD3_COLORS.surface,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
});
