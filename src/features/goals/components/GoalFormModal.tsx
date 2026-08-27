import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import { localDateKey } from '@/shared/domain/productivity/homeStorage';
import type { GoalGravity } from '@/shared/types/models';

type GoalDraft = {
  title: string;
  deadline: string;
  gravity: GoalGravity;
};

type Props = {
  visible: boolean;
  onSubmit: (draft: GoalDraft) => void;
  onCancel: () => void;
};

const deadlineFromToday = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
};

export const GoalFormModal = ({ visible, onSubmit, onCancel }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [title, setTitle] = useState('');
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [gravity, setGravity] = useState<GoalGravity>('low');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDeadlineDays(7);
      setGravity('low');
      setError(null);
    }
  }, [visible]);

  const submit = () => {
    const value = title.trim();
    if (!value) {
      setError('Escribe el resultado que quieres alcanzar.');
      return;
    }
    onSubmit({ title: value, deadline: deadlineFromToday(deadlineDays), gravity });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Nueva meta</Text>
              <Text style={styles.subtitle}>Un resultado concreto que puedas terminar.</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.fieldLabel}>¿Qué quieres lograr?</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              placeholder="Ej. Entregar el proyecto de programación"
              placeholderTextColor={colors.onSurfaceVariant}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Nombre de la meta"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.fieldLabel}>Fecha objetivo</Text>
            <View style={styles.optionsRow}>
              {[7, 14, 30].map((days) => {
                const selected = deadlineDays === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => setDeadlineDays(days)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {days === 7 ? '1 semana' : days === 14 ? '2 semanas' : '1 mes'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.selectionHint}>
              Vence el {new Date(`${deadlineFromToday(deadlineDays)}T00:00:00`).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
              })}
            </Text>

            <Text style={styles.fieldLabel}>Importancia</Text>
            <View style={styles.priorityRow}>
              <TouchableOpacity
                style={[styles.priorityOption, gravity === 'low' && styles.optionSelected]}
                onPress={() => setGravity('low')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gravity === 'low' }}
              >
                <Ionicons name="leaf-outline" size={18} color={gravity === 'low' ? colors.primary : colors.onSurfaceVariant} />
                <View style={styles.priorityCopy}>
                  <Text style={[styles.priorityTitle, gravity === 'low' && styles.optionTextSelected]}>Normal</Text>
                  <Text style={styles.priorityDescription}>Puede avanzar con flexibilidad.</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.priorityOption, gravity === 'high' && styles.importantSelected]}
                onPress={() => setGravity('high')}
                accessibilityRole="radio"
                accessibilityState={{ selected: gravity === 'high' }}
              >
                <Ionicons name="flash-outline" size={18} color={gravity === 'high' ? colors.flame : colors.onSurfaceVariant} />
                <View style={styles.priorityCopy}>
                  <Text style={[styles.priorityTitle, gravity === 'high' && styles.importantText]}>Importante</Text>
                  <Text style={styles.priorityDescription}>Necesita atención prioritaria.</Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={submit}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Crear meta"
          >
            <Text style={styles.submitText}>Crear meta</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.scrim,
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
      alignSelf: 'center',
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    headerCopy: { flex: 1 },
    title: { ...type.headlineSm, color: colors.onSurface },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceContainerLow,
    },
    fieldLabel: {
      ...type.labelLg,
      color: colors.onSurface,
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },
    input: {
      ...type.bodyLg,
      minHeight: 54,
      color: colors.onSurface,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.md,
      paddingHorizontal: SPACING.md,
    },
    inputError: { borderColor: colors.error },
    error: { ...type.bodySm, color: colors.error, marginTop: SPACING.xs },
    optionsRow: { flexDirection: 'row', gap: SPACING.sm },
    option: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xs,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant, textAlign: 'center' },
    optionTextSelected: { color: colors.onPrimaryContainer },
    selectionHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: SPACING.xs },
    priorityRow: { gap: SPACING.sm, marginBottom: SPACING.md },
    priorityOption: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
    },
    importantSelected: { borderColor: colors.flame, backgroundColor: colors.flameContainer },
    priorityCopy: { flex: 1 },
    priorityTitle: { ...type.titleSm, color: colors.onSurface },
    importantText: { color: colors.onFlameContainer },
    priorityDescription: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    submitButton: {
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
    submitText: { ...type.labelLg, color: colors.onPrimary },
  });
};
