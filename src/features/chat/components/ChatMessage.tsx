import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { ChatMessage as ChatMessageType } from '../types/chat';
import { useI18n } from '@/shared/i18n/i18n';

interface Props {
  message: ChatMessageType;
}

/**
 * Mensaje estilo GPT/Gemini: sin burbujas. Prefijo de autor + texto a todo
 * el ancho, con tipografía diferenciada entre usuario y asistente.
 */
export const ChatMessage = React.memo(({ message }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const isUser = message.role === 'user';
  const showThinking = message.streaming && message.content.length === 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.author, isUser ? styles.authorUser : styles.authorBot]}>
        {isUser ? t('chat.you') : 'Sui'}
      </Text>

      {showThinking ? (
        <ActivityIndicator size="small" color={colors.secondary} style={styles.thinking} />
      ) : (
        <Text style={isUser ? styles.textUser : styles.textBot}>
          {message.content}
          {message.streaming && <Text style={styles.cursor}>▍</Text>}
          {message.error && (
            <Text style={styles.errorTag}>{t('chat.failed')}</Text>
          )}
        </Text>
      )}
    </View>
  );
});

const createStyles = ({ colors, type }: AppTheme) => StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  author: {
    ...type.labelMd,
    letterSpacing: 0.4,
    marginBottom: SPACING.xs,
  },
  authorUser: {
    color: colors.onSurfaceVariant,
  },
  authorBot: {
    color: colors.secondary,
  },
  textUser: {
    ...type.titleMd,
    color: colors.onSurface,
  },
  textBot: {
    ...type.bodyLg,
    color: colors.onSurface,
  },
  cursor: {
    ...type.titleMd,
    color: colors.secondary,
  },
  thinking: {
    alignSelf: 'flex-start',
    marginVertical: SPACING.xs,
  },
  errorTag: {
    ...type.labelMd,
    color: colors.error,
  },
});
