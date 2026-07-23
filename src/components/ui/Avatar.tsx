/**
 * Avatar — círculo con inicial del nombre.
 *
 * Variantes: primary (relleno) | surface (outline sutil).
 * Tamaños: sm (32) | md (40) | lg (56).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ColorScheme, useAppTheme } from '../../theme/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarVariant = 'primary' | 'surface';

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  variant?: AvatarVariant;
  style?: ViewStyle;
};

const SIZES: Record<AvatarSize, { box: number; font: number }> = {
  sm: { box: 32, font: 14 },
  md: { box: 40, font: 16 },
  lg: { box: 56, font: 22 },
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
  const { colors } = useAppTheme();
  const dims = SIZES[size];
  const styles = useMemo(() => createStyles(colors, dims.box, dims.font, variant), [
    colors,
    dims.box,
    dims.font,
    variant,
  ]);

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
  colors: ColorScheme,
  box: number,
  font: number,
  variant: AvatarVariant,
) =>
  StyleSheet.create({
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
      fontSize: font,
      fontWeight: '800',
      color: variant === 'primary' ? colors.onPrimary : colors.onSurface,
    },
  });
