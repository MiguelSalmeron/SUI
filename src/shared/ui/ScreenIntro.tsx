import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';

type Props = {
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
};

/** Encabezado consistente para pantallas de primer nivel en móvil. */
export const ScreenIntro = ({
  title,
  subtitle,
  actionLabel,
  actionIcon = 'add',
  onAction,
}: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {onAction ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onAction}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Ionicons name={actionIcon} size={21} color={theme.colors.onPrimary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    copy: {
      flex: 1,
    },
    title: {
      ...theme.type.headlineSm,
      color: theme.colors.onSurface,
    },
    subtitle: {
      ...theme.type.bodyMd,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
      maxWidth: 310,
    },
    action: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
  });
