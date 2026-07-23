import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import type { Achievement } from '../../services/gamification';

type Props = {
  achievements: Achievement[];
  compact?: boolean;
};

export const AchievementGrid = ({ achievements, compact = false }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);
  const display = compact ? unlocked.slice(0, 4) : achievements;

  if (compact && unlocked.length === 0) return null;

  const content = (
    <View style={styles.grid}>
      {display.map((a) => (
        <View
          key={a.id}
          style={[styles.badge, a.unlocked ? styles.badgeUnlocked : styles.badgeLocked]}
        >
          <View style={[styles.iconWrap, a.unlocked ? styles.iconUnlocked : styles.iconLocked]}>
            <Ionicons
              name={a.icon as keyof typeof Ionicons.glyphMap}
              size={compact ? 18 : 22}
              color={a.unlocked ? colors.onPrimary : colors.onSurfaceVariant}
            />
          </View>
          <Text style={[styles.badgeTitle, !a.unlocked && styles.badgeTitleLocked]} numberOfLines={1}>
            {a.title}
          </Text>
          {!compact && (
            <Text style={styles.badgeDesc} numberOfLines={2}>
              {a.description}
            </Text>
          )}
        </View>
      ))}
    </View>
  );

  if (compact) {
    return (
      <View style={styles.compactSection}>
        <Text style={styles.sectionTitle}>Logros desbloqueados ({unlocked.length}/{achievements.length})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
          {unlocked.map((a) => (
            <View key={a.id} style={styles.compactBadge}>
              <View style={styles.compactIcon}>
                <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={20} color={colors.onPrimary} />
              </View>
              <Text style={styles.compactTitle}>{a.title}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        Logros · {unlocked.length} de {achievements.length}
      </Text>
      {content}
      {locked.length > 0 && (
        <Text style={styles.hint}>
          {locked.length} logro{locked.length > 1 ? 's' : ''} por desbloquear
        </Text>
      )}
    </View>
  );
};

const createStyles = (colors: ColorScheme, compact: boolean) =>
  StyleSheet.create({
    section: {
      marginBottom: SPACING.md,
    },
    compactSection: {
      marginBottom: SPACING.sm,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.onSurface,
      marginBottom: SPACING.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    badge: {
      width: compact ? '30%' : '47%',
      borderRadius: 18,
      padding: SPACING.md,
      borderWidth: 1,
    },
    badgeUnlocked: {
      backgroundColor: colors.primaryContainer,
      borderColor: colors.primary,
    },
    badgeLocked: {
      backgroundColor: colors.surfaceContainer,
      borderColor: colors.outlineVariant,
      opacity: 0.6,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xs,
    },
    iconUnlocked: {
      backgroundColor: colors.primary,
    },
    iconLocked: {
      backgroundColor: colors.outlineVariant,
    },
    badgeTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.onSurface,
    },
    badgeTitleLocked: {
      color: colors.onSurfaceVariant,
    },
    badgeDesc: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 2,
      lineHeight: 15,
    },
    hint: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginTop: SPACING.sm,
      fontWeight: '600',
    },
    horizontal: {
      gap: SPACING.sm,
      paddingRight: SPACING.md,
    },
    compactBadge: {
      alignItems: 'center',
      backgroundColor: colors.primaryContainer,
      borderRadius: 16,
      padding: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderWidth: 1,
      borderColor: colors.primary,
      minWidth: 90,
    },
    compactIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    compactTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.onPrimaryContainer,
      textAlign: 'center',
    },
  });
