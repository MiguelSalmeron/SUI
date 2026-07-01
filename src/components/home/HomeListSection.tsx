import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';

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
        >
          <Text style={styles.addButtonText}>{addLabel}</Text>
        </TouchableOpacity>

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <TouchableOpacity
                style={[styles.statusPill, item.completed && styles.statusPillDone]}
                onPress={() => onToggle(item.id)}
              >
                <Text style={styles.statusText}>{item.completed ? 'Hecho' : 'Pend.'}</Text>
              </TouchableOpacity>

              <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>{item.title}</Text>

              <TouchableOpacity onPress={() => onRemove(item.id)}>
                <Text style={styles.deleteText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: MD3_COLORS.onSurface,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: MD3_COLORS.onSurfaceVariant,
    fontSize: 14,
  },
  card: {
    backgroundColor: MD3_COLORS.surface,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    shadowColor: MD3_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardText: {
    fontSize: 15,
    color: MD3_COLORS.onSurfaceVariant,
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  addButton: {
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  addButtonPrimary: {
    backgroundColor: MD3_COLORS.primary,
  },
  addButtonSecondary: {
    backgroundColor: MD3_COLORS.secondary,
  },
  addButtonText: {
    color: MD3_COLORS.surface,
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
    borderTopColor: MD3_COLORS.outlineVariant,
  },
  statusPill: {
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: MD3_COLORS.background,
    alignItems: 'center',
  },
  statusPillDone: {
    backgroundColor: MD3_COLORS.success,
  },
  statusText: {
    color: MD3_COLORS.onSurface,
    fontSize: 12,
    fontWeight: '800',
  },
  itemTitle: {
    flex: 1,
    color: MD3_COLORS.onSurface,
    fontSize: 15,
  },
  itemTitleDone: {
    color: MD3_COLORS.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  deleteText: {
    color: MD3_COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
});
