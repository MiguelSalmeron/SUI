/**
 * Avatar — círculo con inicial del nombre.
 *
 * Variantes: primary (relleno) | surface (outline sutil).
 * Tamaños: sm (32) | md (40) | lg (56).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useI18n } from '@/shared/i18n/i18n';
import { IDENTITY_PALETTE, IDENTITY_FOREGROUND } from '@/shared/theme/tokens';
import type { UserIdentity } from '@sui/contracts';
import { resolveLocalPhoto } from '@/shared/infrastructure/profile/localPhoto';
import { AppTheme, TypographyToken, useAppTheme } from '@/shared/theme/theme';

export type AvatarSize = 'sm' | 'md' | 'lg';
export type AvatarVariant = 'primary' | 'surface';

export type AvatarProps = {
  name: string;
  source?: string;
  accentColor?: UserIdentity['accentColor'];
  detail?: string;
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
  source,
  accentColor,
  detail,
}) => {
  const [resolved, setResolved] = useState<{ source?: string; uri?: string }>();
  const [failedSource, setFailedSource] = useState<string>();
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setResolved(undefined);
    void resolveLocalPhoto(source)
      .then((uri) => {
        if (!active) {
          if (source?.startsWith('identity-photo:') && uri) URL.revokeObjectURL(uri);
          return;
        }
        objectUrl = uri;
        setResolved({ source, uri });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (source?.startsWith('identity-photo:') && objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);
  const { t } = useI18n();
  const theme = useAppTheme();
  const dims = SIZES[size];
  const styles = useMemo(
    () => createStyles(theme, dims.box, dims.token, variant),
    [theme, dims.box, dims.token, variant],
  );

  return (
    <View
      style={[
        styles.base,
        accentColor && { backgroundColor: IDENTITY_PALETTE[accentColor], borderWidth: 1 },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={t('settings.identityAvatar', { name })}
    >
      {resolved?.source === source && resolved?.uri && failedSource !== source ? (
        <Image
          testID="avatar-photo"
          source={{ uri: resolved.uri }}
          style={StyleSheet.absoluteFill}
          onError={() => setFailedSource(source)}
          accessible={false}
        />
      ) : (
        <Text style={[styles.initial, accentColor && { color: IDENTITY_FOREGROUND }]}>
          {detail || initialOf(name)}
        </Text>
      )}
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
      overflow: 'hidden',
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
