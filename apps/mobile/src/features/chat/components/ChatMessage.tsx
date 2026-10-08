import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SuiAvatar } from '@/shared/ui/SuiMark';
import { Ionicons } from '@/shared/ui/Ionicons';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { ChatMessage as ChatMessageType } from '../types/chat';
import { useI18n } from '@/shared/i18n/i18n';
import { StreamingCursor } from './StreamingCursor';

interface Props {
  message: ChatMessageType;
  /** true sólo para el último mensaje de Sui: ahí viven copiar, reintentar y detener. */
  isLastAssistant?: boolean;
  /** Frase de espera honesta que pone la pantalla (null si la respuesta llegó rápido). */
  waitingText?: string | null;
  onRetry?: () => void;
  onStop?: () => void;
}

/**
 * Burbuja del corte 1, sin componentes nuevos.
 *
 * Vos a la derecha, Sui a la izquierda con su marca de 20 dp y hora local.
 * Las acciones sólo aparecen en el último mensaje de Sui para no llenar el
 * hilo de botones repetidos. El error no inventa causas: hoy `onError` no
 * separa red del límite del proxy, así que el copy es uno solo.
 */
export const ChatMessage = React.memo(function ChatMessage({
  message,
  isLastAssistant = false,
  waitingText = null,
  onRetry,
  onStop,
}: Props) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { locale, t } = useI18n();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si salís del hilo con el "Copiado" a la vista, el timer no queda colgado.
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );

  const timeLabel = useMemo(() => {
    try {
      return new Date(message.createdAt).toLocaleTimeString(locale === 'es' ? 'es' : 'en', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [locale, message.createdAt]);

  const showWaiting = message.streaming && message.content.length === 0;
  const showActions = !isUser && isLastAssistant;
  const showStop = showActions && !!message.streaming;
  const showCopyRetry = showActions && !message.streaming;

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await Clipboard.setStringAsync(message.content);
    } catch {
      // El portapapeles puede fallar sin permiso: igual avisamos el intento.
    }
    setCopied(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const handleStop = () => {
    // Sin háptico acá: lo dispara la pantalla en `handleStop` para que no
    // vibre dos veces al detener desde la burbuja.
    onStop?.();
  };

  if (isUser) {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
          {timeLabel ? <Text style={styles.userTime}>{timeLabel}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.botRow}>
      <View style={styles.botHeader}>
        <SuiAvatar size={20} />
        <Text style={styles.botAuthor}>{t('chat.assistantName')}</Text>
        {timeLabel ? <Text style={styles.botTime}>{timeLabel}</Text> : null}
      </View>

      <View style={styles.botBubble}>
        {showWaiting ? (
          waitingText ? (
            <Text accessibilityLiveRegion="polite" style={styles.botText}>
              {waitingText}
            </Text>
          ) : null
        ) : (
          <View style={styles.contentRow}>
            <Text style={styles.botText}>{message.content}</Text>
            {message.streaming && !message.error ? <StreamingCursor /> : null}
          </View>
        )}
        {message.error && !message.streaming && (
          <Text style={styles.errorText}>{t('chat.connectionLost')}</Text>
        )}
      </View>

      {showStop && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleStop}
            accessibilityRole="button"
            accessibilityLabel={t('chat.stop')}
          >
            <Ionicons name="stop" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.actionLabel}>{t('chat.stop')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showCopyRetry && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopy}
            disabled={!message.content}
            accessibilityRole="button"
            accessibilityLabel={copied ? t('chat.copied') : t('chat.copy')}
          >
            <Ionicons name="copy-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.actionLabel}>{copied ? t('chat.copied') : t('chat.copy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t('chat.retry')}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.onSurfaceVariant} />
            <Text style={styles.actionLabel}>{t('chat.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    userRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: SPACING.lg,
    },
    userBubble: {
      maxWidth: '82%',
      backgroundColor: colors.primaryContainer,
      borderRadius: 18,
      borderBottomRightRadius: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    userText: {
      ...type.bodyLg,
      color: colors.onPrimaryContainer,
    },
    userTime: {
      ...type.labelXs,
      color: colors.onPrimaryContainer,
      opacity: 0.7,
      textAlign: 'right',
      marginTop: SPACING.xs,
    },
    botRow: {
      alignItems: 'flex-start',
      marginBottom: SPACING.lg,
    },
    botHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    botAuthor: {
      ...type.labelMd,
      color: colors.secondary,
    },
    botTime: {
      ...type.labelXs,
      color: colors.onSurfaceVariant,
    },
    botBubble: {
      maxWidth: '100%',
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 18,
      borderTopLeftRadius: 6,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    botText: {
      flexShrink: 1,
      ...type.bodyLg,
      color: colors.onSurface,
    },
    contentRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.xs,
    },
    errorText: {
      ...type.bodyMd,
      color: colors.error,
      marginTop: SPACING.xs,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.xs,
      marginTop: SPACING.xs,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: SPACING.sm,
      justifyContent: 'center',
    },
    actionLabel: {
      ...type.labelMd,
      color: colors.onSurfaceVariant,
    },
  });
