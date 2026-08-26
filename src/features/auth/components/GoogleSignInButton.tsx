import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '@/shared/theme/theme';

type GoogleSignInButtonProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * CTA secundario “Continuar / Vincular con Google” — onboarding y flujos similares.
 */
export const GoogleSignInButton = React.memo(function GoogleSignInButton({
  label,
  onPress,
  busy = false,
  disabled = false,
  style,
}: GoogleSignInButtonProps) {
  const { colors } = useAppTheme();
  const styles = buttonStyles(colors);
  const isDisabled = disabled || busy;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: isDisabled }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="logo-google" size={18} color={colors.primary} />
      )}
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
});

const buttonStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 12,
      paddingVertical: SPACING.md,
      minHeight: 48,
    },
    disabled: {
      opacity: 0.55,
    },
    label: {
      color: colors.onSurface,
      fontWeight: '700',
      fontSize: 15,
    },
  });
