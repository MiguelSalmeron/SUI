import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { ChatMessage as ChatMessageType } from '../../types/chat';

interface Props {
  message: ChatMessageType;
}

/**
 * Mensaje estilo GPT/Gemini: sin burbujas. Prefijo de autor + texto a todo
 * el ancho, con tipografía diferenciada entre usuario y asistente.
 */
export const ChatMessage = ({ message }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUser = message.role === 'user';
  const showThinking = message.streaming && message.content.length === 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.author, isUser ? styles.authorUser : styles.authorBot]}>
        {isUser ? 'Tú' : 'SUI'}
      </Text>

      {showThinking ? (
        <ActivityIndicator size="small" color={colors.secondary} style={styles.thinking} />
      ) : (
        <Text style={[styles.text, isUser ? styles.textUser : styles.textBot]}>
          {message.content}
          {message.streaming && <Text style={styles.cursor}>▍</Text>}
          {message.error && (
            <Text style={styles.errorTag}>  (no se pudo enviar)</Text>
          )}
        </Text>
      )}
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  author: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  authorUser: {
    color: colors.onSurfaceVariant,
  },
  authorBot: {
    color: colors.secondary,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  textUser: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  textBot: {
    color: colors.onSurface,
    fontWeight: '400',
  },
  cursor: {
    color: colors.secondary,
    fontWeight: '700',
  },
  thinking: {
    alignSelf: 'flex-start',
    marginVertical: SPACING.xs,
  },
  errorTag: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
});
