import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import type { UserIntention } from '@/shared/account/introTypes';

interface IntentionCardProps {
  id: UserIntention;
  title: string;
  description: string;
  iconName: IoniconName;
  selected: boolean;
  onSelect: (id: UserIntention) => void;
}

export const IntentionCard = ({
  id,
  title,
  description,
  iconName,
  selected,
  onSelect,
}: IntentionCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, selected), [theme, selected]);

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    onSelect(id);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.7}
    >
      <View style={styles.iconBox}>
        <Ionicons
          name={iconName}
          size={24}
          color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      </View>

      <View style={styles.textBox}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.radioBox}>
        <View style={styles.radioOuter}>
          {selected && <View style={styles.radioInner} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme, selected: boolean) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
      backgroundColor: selected
        ? theme.colors.primaryContainer
        : theme.colors.surfaceContainerLowest,
      marginBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.sm,
      backgroundColor: selected ? theme.colors.surface : theme.colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBox: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...theme.type.titleMd,
      color: theme.colors.onSurface,
    },
    description: {
      ...theme.type.bodySm,
      color: theme.colors.onSurfaceVariant,
    },
    radioBox: {
      paddingLeft: SPACING.xs,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: selected ? theme.colors.primary : theme.colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.primary,
    },
  });
