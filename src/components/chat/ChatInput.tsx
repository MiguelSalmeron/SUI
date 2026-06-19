import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';
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
        placeholderTextColor={COLORS.textSecondary}
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
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.accent,
  },
  sendText: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
});
