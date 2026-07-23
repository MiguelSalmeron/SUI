import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';

export type HomeListItem = {
  id: string;
  title: string;
  completed: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  emptyText: string;
  addLabel: string;
  items: HomeListItem[];
  accent: 'primary' | 'secondary';
  onAdd: () => void;
  onToggle: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onItemCompleted?: (title: string) => void;
};

export const HomeListSection = ({
  title,
  subtitle,
  emptyText,
  addLabel,
  items,
  accent,
  onAdd,
  onToggle,
  onRemove,
  onItemCompleted,
}: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completedCount = items.filter((item) => item.completed).length;
  const progress = items.length === 0 ? 0 : completedCount / items.length;
  const accentColor = accent === 'secondary' ? colors.secondary : colors.primary;
  const onAccentColor = accent === 'secondary' ? colors.onSecondary : colors.onPrimary;

  return (
    <View style={styles.sectionSpacing}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.card}>
        {items.length > 0 ? (
          <>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>
                {completedCount}/{items.length} completados
              </Text>
              <Text style={[styles.progressPercent, { color: accentColor }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: accentColor },
                ]}
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={32} color={colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: accentColor }]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <Ionicons name="add" size={20} color={onAccentColor} />
          <Text style={[styles.addButtonText, { color: onAccentColor }]}>{addLabel}</Text>
        </TouchableOpacity>

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={[styles.itemRow, item.completed && styles.itemRowDone]}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  item.completed
                    ? { backgroundColor: colors.success, borderColor: colors.success }
                    : { borderColor: colors.outline },
                ]}
                onPress={() => {
                  if (!item.completed) {
                    onToggle(item.id);
                    onItemCompleted?.(item.title);
                    return;
                  }
                  onToggle(item.id);
                }}
                accessibilityRole="checkbox"
                accessibilityLabel={`${item.completed ? 'Desmarcar' : 'Completar'} ${item.title}`}
                accessibilityState={{ checked: item.completed }}
              >
                {item.completed && (
                  <Ionicons name="checkmark" size={16} color={colors.onSuccess} />
                )}
              </TouchableOpacity>

              <Text
                style={[styles.itemTitle, item.completed && styles.itemTitleDone]}
                numberOfLines={2}
              >
                {item.title}
              </Text>

              <TouchableOpacity
                onPress={() => onRemove(item.id)}
                style={styles.deleteBtn}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.title}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onSurface,
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: '900',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.outlineVariant,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  addButton: {
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  addButtonText: {
    fontWeight: '800',
    fontSize: 15,
  },
  list: {
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: 14,
  },
  itemRowDone: {
    backgroundColor: colors.surfaceContainerLow,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  itemTitleDone: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    padding: 6,
  },
});
