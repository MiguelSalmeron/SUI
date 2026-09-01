/**
 * Avatar — círculo con inicial del nombre.
 *
 * Variantes: primary (relleno) | surface (outline sutil).
 * Tamaños: sm (32) | md (40) | lg (56).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AppTheme, TypographyToken, useAppTheme } from '@/shared/theme/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarVariant = 'primary' | 'surface';

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  style?: ViewStyle;
};

const SIZES: Record<AvatarSize, { box: number; token: TypographyToken }> = {
  sm: { box: 32, token: 'labelLg' },
  md: { box: 40, token: 'titleMd' },
  lg: { box: 56, token: 'headlineSm' },
};

const initialOf = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = trimmed[0];
  return first.toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  variant = 'primary',
  style,
}) => {
  const theme = useAppTheme();
  const dims = SIZES[size];
  const styles = useMemo(
    () => createStyles(theme, dims.box, dims.token, variant),
    [theme, dims.box, dims.token, variant],
  );

  return (
    <View
      style={[styles.base, style]}
      accessibilityRole="image"
      accessibilityLabel={`Avatar de ${name}`}
    >
      <Text style={styles.initial}>{initialOf(name)}</Text>
    </View>
  );
};

const createStyles = (
  theme: AppTheme,
  box: number,
  token: TypographyToken,
  variant: AvatarVariant,
) => {
  const { colors, type } = theme;
  return StyleSheet.create({
    base: {
      width: box,
      height: box,
      borderRadius: box / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: variant === 'primary' ? colors.primary : colors.surfaceContainer,
      borderWidth: variant === 'surface' ? 1 : 0,
      borderColor: colors.outlineVariant,
    },
    initial: {
      ...type[token],
      color: variant === 'primary' ? colors.onPrimary : colors.onSurface,
    },
  });
};
