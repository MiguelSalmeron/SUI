import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from './Ionicons';
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
          <Ionicons name={actionIcon} size={19} color={theme.colors.onPrimary} />
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    copy: {
      flex: 1,
      minWidth: 180,
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
      minHeight: 44,
      maxWidth: '100%',
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      marginTop: 2,
    },
    actionText: { ...theme.type.labelMd, color: theme.colors.onPrimary, flexShrink: 1 },
  });
