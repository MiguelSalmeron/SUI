/**
 * ConfirmModal — confirmación de dos acciones (cancelar / confirmar).
 *
 * Reemplaza Alert.alert en web: react-native-web 0.21 implementa Alert como no-op.
 * Compatible dark/light. El botón confirmar puede ser destructivo.
 */

import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { ColorScheme, MD3_RADIUS, SPACING, useAppTheme } from '@/shared/theme/theme';
import { PressableCard } from './PressableCard';

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
  testID,
}) => {
  const { colors, type, radius } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius), [colors, radius]);
  const confirmBackground = destructive ? colors.error : colors.primary;
  const confirmForeground = destructive ? colors.onError : colors.onPrimary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card} testID={testID}>
          <Text style={[type.headlineSm, styles.title]}>{title}</Text>
          <Text style={[type.bodyMd, styles.message]}>{message}</Text>
          {error ? (
            <Text style={[type.bodySm, styles.errorText]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            <PressableCard
              onPress={onCancel}
              disabled={busy}
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
              onPress={onConfirm}
              disabled={busy}
              level="level1"
              radius="lg"
              style={styles.button}
              contentStyle={styles.buttonContent}
              backgroundColor={confirmBackground}
              stateLayerColor={confirmForeground}
              accessibilityLabel={confirmLabel}
            >
              {busy ? (
                <ActivityIndicator color={confirmForeground} />
              ) : (
                <Text style={[type.labelLg, { color: confirmForeground }]}>{confirmLabel}</Text>
              )}
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
    message: {
      color: colors.onSurfaceVariant,
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
      minHeight: 48,
    },
  });
