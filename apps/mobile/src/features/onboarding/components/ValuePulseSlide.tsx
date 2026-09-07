import { useMemo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { useOrganicEntrance } from '../hooks/useOrganicEntrance';

interface ValuePulseSlideProps {
  title: string;
  description: string;
  doodleVariant: 'sprout' | 'path' | 'rhythm';
  iconName: IoniconName;
  accentColor?: string;
  containerColor?: string;
}

export const ValuePulseSlide = ({
  title,
  description,
  doodleVariant,
  iconName,
  accentColor,
  containerColor,
}: ValuePulseSlideProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entrance = useOrganicEntrance({ distance: 20 });

  const activeAccent = accentColor ?? theme.colors.primary;
  const activeContainer = containerColor ?? theme.colors.primaryContainer;

  return (
    <Animated.View style={[styles.container, entrance.animatedStyle]}>
      <View style={[styles.visualBox, { backgroundColor: activeContainer }]}>
        <SuiDoodle variant={doodleVariant} size={78} color={activeAccent} />
        <View style={[styles.iconBadge, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name={iconName} size={24} color={activeAccent} />
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    visualBox: {
      width: 140,
      height: 140,
      borderRadius: theme.radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xl,
      position: 'relative',
    },
    iconBadge: {
      position: 'absolute',
      bottom: -10,
      right: -10,
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.outlineVariant,
      elevation: 2,
    },
    title: {
      ...theme.type.headlineSm,
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    description: {
      ...theme.type.bodyLg,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingHorizontal: SPACING.sm,
    },
  });
