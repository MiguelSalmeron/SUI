import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';

type Props = {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export const AppleSignInButton = ({ label, busy = false, disabled = false, onPress }: Props) => {
  const { colors, radius, type } = useAppTheme();
  const isDisabled = disabled || busy;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { borderRadius: radius.full, borderColor: colors.outlineVariant },
        isDisabled && { opacity: 0.55 },
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
    >
      {busy ? (
        <ActivityIndicator color={colors.onSurface} />
      ) : (
        <Ionicons name="logo-apple" size={21} color={colors.onSurface} />
      )}
      <Text style={[type.titleMd, { color: colors.onSurface }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
});
