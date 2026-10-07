import { useMemo } from 'react';
import type { RefObject } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { MAX_INPUT_CHARS } from '../types/chat';
import { useI18n } from '@/shared/i18n/i18n';

interface Props {
  /** true mientras el asistente responde: el mismo botón pasa a detener. */
  busy: boolean;
  text: string;
  onChangeText: (text: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  inputRef?: RefObject<TextInput | null>;
}

/**
 * Cápsula de escritura del corte 1.
 *
 * Una sola cápsula flotante, sin botón [+]: hoy no hay nada que adjuntar y un
 * botón vacío mentiría. El campo nunca se bloquea mientras Sui responde para
 * que podás seguir escribiendo; el vaciado vive en la pantalla, después de
 * pasar la crisis.
 */
export const ChatInput = ({ busy, text, onChangeText, onSend, onStop, inputRef }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();

  const trimmedLength = text.trim().length;
  const isStopping = busy;
  // Fijate que en streaming el botón siempre está habilitado como detener,
  // aunque el campo esté vacío: detener no necesita texto.
  const sendDisabled = isStopping ? false : trimmedLength === 0;
  const nearLimit = text.length >= 950;

  const submit = () => {
    // Si Sui está respondiendo, este mismo botón detiene en vez de enviar.
    if (isStopping) {
      onStop();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    // El vaciado lo hace la pantalla después de pasar detectCrisis, así el
    // borrador sobrevive si se abre el overlay de crisis.
    onSend(trimmed);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.capsule}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={colors.onSurfaceVariant}
          value={text}
          onChangeText={onChangeText}
          maxLength={MAX_INPUT_CHARS}
          multiline
          editable
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
          onPress={submit}
          disabled={sendDisabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isStopping ? t('chat.stop') : t('chat.send')}
          accessibilityState={{ disabled: sendDisabled }}
        >
          <Ionicons
            name={isStopping ? 'stop' : 'arrow-up'}
            size={22}
            color={sendDisabled ? colors.onSurfaceVariant : colors.onPrimary}
          />
        </TouchableOpacity>
      </View>
      <Text
        style={[styles.counter, nearLimit && styles.counterNearLimit]}
        accessibilityLabel={`${text.length}/1000`}
      >
        {text.length}/1000
      </Text>
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.background,
    },
    capsule: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 9999,
      paddingLeft: SPACING.md,
      paddingRight: SPACING.xs,
      paddingVertical: SPACING.xs,
    },
    input: {
      ...type.bodyLg,
      flex: 1,
      maxHeight: 120,
      paddingVertical: SPACING.sm,
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
    counter: {
      ...type.labelXs,
      color: colors.onSurfaceVariant,
      textAlign: 'right',
      marginTop: SPACING.xs,
      marginRight: SPACING.sm,
    },
    counterNearLimit: {
      color: colors.flame,
    },
  });
