/**
 * PromptModal — Modal reusable para prompts de texto/numéricos.
 *
 * Reemplaza los modales duplicados de GoalsScreen y PomodoroScreen.
 * - Tipado estricto, cero `any`.
 * - Validación delegada al caller vía `validate`.
 * - Compatible dark/light.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorScheme, MD3_RADIUS, SPACING, useAppTheme } from '../../theme/theme';
import { PressableCard } from './PressableCard';

export type PromptModalProps = {
  visible: boolean;
  title: string;
  hint?: string;
  placeholder?: string;
  initialValue?: string;
  keyboardType?: KeyboardTypeOptions;
  submitLabel?: string;
  cancelLabel?: string;
  /** Devuelve mensaje de error o null si es válido. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  testID?: string;
};

export const PromptModal: React.FC<PromptModalProps> = ({
  visible,
  title,
  hint,
  placeholder,
  initialValue = '',
  keyboardType,
  submitLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  validate,
  onSubmit,
  onCancel,
  testID,
}) => {
  const { colors, type, radius } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius), [colors, radius]);
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
    }
  }, [visible, initialValue]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (validate) {
      const message = validate(trimmed);
      if (message) {
        setError(message);
        return;
      }
    }
    setError(null);
    onSubmit(trimmed);
  }, [value, validate, onSubmit]);

  const handleChange = useCallback((text: string) => {
    setValue(text);
    setError(null);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID={testID}>
          <Text style={[type.headlineSm, styles.title]}>{title}</Text>
          {hint ? <Text style={[type.bodyMd, styles.hint]}>{hint}</Text> : null}
          <TextInput
            style={[type.bodyLg, styles.input, error ? styles.inputError : null]}
            placeholder={placeholder}
            placeholderTextColor={colors.onSurfaceVariant}
            value={value}
            onChangeText={handleChange}
            keyboardType={keyboardType}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            accessibilityLabel={title}
          />
          {error ? (
            <Text style={[type.bodySm, styles.errorText]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            <PressableCard
              onPress={onCancel}
              level="level0"
              radius="lg"
              style={styles.button}
              contentStyle={styles.buttonContent}
              backgroundColor={colors.surfaceContainerLow}
              accessibilityLabel={cancelLabel}
            >
              <Text style={[type.labelLg, { color: colors.primary }]}>{cancelLabel}</Text>
            </PressableCard>
            <PressableCard
              onPress={handleSubmit}
              level="level1"
              radius="lg"
              style={styles.button}
              contentStyle={styles.buttonContent}
              backgroundColor={colors.primary}
              stateLayerColor={colors.onPrimary}
              accessibilityLabel={submitLabel}
            >
              <Text style={[type.labelLg, { color: colors.onPrimary }]}>{submitLabel}</Text>
            </PressableCard>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorScheme, radius: typeof MD3_RADIUS) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    title: {
      color: colors.onSurface,
    },
    hint: {
      color: colors.onSurfaceVariant,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.md,
      padding: SPACING.md,
      color: colors.onSurface,
      marginTop: SPACING.xs,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
    },
    buttons: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    button: {
      flex: 1,
    },
    buttonContent: {
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
