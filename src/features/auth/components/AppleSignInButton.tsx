import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';

type Props = {
  label: string;
  busy?: boolean;
  onPress: () => void;
};

export const AppleSignInButton = ({ label, busy = false, onPress }: Props) => {
  const { colors, radius, type } = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.button, { borderRadius: radius.full, borderColor: colors.outlineVariant }]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
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
