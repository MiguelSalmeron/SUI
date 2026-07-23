import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
}: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completedCount = items.filter((item) => item.completed).length;
  const pendingCount = items.length - completedCount;

  return (
    <View style={styles.sectionSpacing}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardText}>
          {items.length === 0 ? emptyText : `${pendingCount} pendientes · ${completedCount} completadas`}
        </Text>

        <TouchableOpacity
          style={[styles.addButton, accent === 'secondary' ? styles.addButtonSecondary : styles.addButtonPrimary]}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
        >
          <Text style={styles.addButtonText}>{addLabel}</Text>
        </TouchableOpacity>

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <TouchableOpacity
                style={[styles.statusPill, item.completed && styles.statusPillDone]}
                onPress={() => onToggle(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.completed ? 'Desmarcar' : 'Completar'} ${item.title}`}
                accessibilityState={{ checked: item.completed }}
              >
                <Text style={styles.statusText}>{item.completed ? 'Hecho' : 'Pend.'}</Text>
              </TouchableOpacity>

              <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>{item.title}</Text>

              <TouchableOpacity
                onPress={() => onRemove(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.title}`}
              >
                <Text style={styles.deleteText}>Eliminar</Text>
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
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardText: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  addButton: {
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  addButtonPrimary: {
    backgroundColor: colors.primary,
  },
  addButtonSecondary: {
    backgroundColor: colors.secondary,
  },
  addButtonText: {
    color: colors.surface,
    fontWeight: '800',
  },
  list: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  statusPill: {
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  statusPillDone: {
    backgroundColor: colors.success,
  },
  statusText: {
    color: colors.onSurface,
    fontSize: 12,
    fontWeight: '800',
  },
  itemTitle: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 15,
  },
  itemTitleDone: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  deleteText: {
    color: colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
});
