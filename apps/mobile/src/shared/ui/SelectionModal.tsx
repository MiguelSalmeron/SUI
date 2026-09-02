import { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import { Ionicons } from './Ionicons';

export type SelectionOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  visible: boolean;
  title: string;
  value: T;
  options: SelectionOption<T>[];
  closeLabel: string;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export const SelectionModal = <T extends string>({
  visible,
  title,
  value,
  options,
  closeLabel,
  onSelect,
  onClose,
}: Props<T>) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const titleRef = useRef<Text>(null);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      const node = findNodeHandle(titleRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 150);
    return () => clearTimeout(timeout);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text ref={titleRef} style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <TouchableOpacity
              style={styles.close}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            >
              <Ionicons name="close" size={21} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <TouchableOpacity
                key={option.value}
                style={styles.option}
                onPress={() => {
                  onSelect(option.value);
                  AccessibilityInfo.announceForAccessibility(option.label);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
      backgroundColor: theme.colors.scrim,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      padding: SPACING.md,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
    },
    header: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    title: { ...theme.type.titleLg, color: theme.colors.onSurface, flex: 1 },
    close: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    option: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.sm,
    },
    optionText: { ...theme.type.bodyLg, color: theme.colors.onSurfaceVariant, flex: 1 },
    optionTextSelected: { color: theme.colors.onSurface },
  });
