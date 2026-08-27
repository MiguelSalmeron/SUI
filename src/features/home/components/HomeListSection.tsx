import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';

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
  onEdit?: (item: HomeListItem) => void;
  onRemove: (itemId: string) => void;
  onItemCompleted?: (title: string) => void;
};

type ItemRowProps = {
  item: HomeListItem;
  theme: AppTheme;
  onToggle: (itemId: string) => void;
  onEdit?: (item: HomeListItem) => void;
  onRemove: (itemId: string) => void;
  onItemCompleted?: (title: string) => void;
};

const HomeListItemRow = React.memo(({ item, theme, onToggle, onEdit, onRemove, onItemCompleted }: ItemRowProps) => {
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.itemRow, item.completed && styles.itemRowDone]}>
      <TouchableOpacity
        style={[
          styles.checkbox,
          item.completed
            ? { backgroundColor: colors.success, borderColor: colors.success }
            : { borderColor: colors.outline },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
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

      {onEdit && (
        <TouchableOpacity
          onPress={() => onEdit(item)}
          style={styles.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${item.title}`}
        >
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.actionBtn}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${item.title}`}
      >
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
});

export const HomeListSection = ({
  title,
  subtitle,
  emptyText,
  addLabel,
  items,
  accent,
  onAdd,
  onToggle,
  onEdit,
  onRemove,
  onItemCompleted,
}: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
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
            <HomeListItemRow
              key={item.id}
              item={item}
              theme={theme}
              onToggle={onToggle}
              onEdit={onEdit}
              onRemove={onRemove}
              onItemCompleted={onItemCompleted}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const createStyles = ({ colors, type }: AppTheme) => StyleSheet.create({
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...type.titleLg,
    color: colors.onSurface,
  },
  sectionSubtitle: {
    ...type.bodyMd,
    marginTop: 4,
    color: colors.onSurfaceVariant,
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
    ...type.labelLg,
    color: colors.onSurface,
  },
  progressPercent: {
    ...type.titleMd,
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
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
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
    ...type.titleMd,
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
    ...type.titleMd,
    flex: 1,
    color: colors.onSurface,
  },
  itemTitleDone: {
    color: colors.onSurfaceVariant,
    textDecorationLine: 'line-through',
  },
  actionBtn: {
    padding: 6,
  },
});
