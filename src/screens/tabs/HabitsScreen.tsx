import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { useHomeStore } from '../../store/useHomeStore';
import { useCelebrationStore } from '../../store/useCelebrationStore';
import { PromptModal } from '../../components/ui/PromptModal';
import { localDateKey } from '../../services/homeStorage';

export const HabitsScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const celebrate = useCelebrationStore((s) => s.trigger);

  const habits = useHomeStore((s) => s.habits);
  const goals = useHomeStore((s) => s.goals);
  const addHabit = useHomeStore((s) => s.addHabit);
  const toggleHabit = useHomeStore((s) => s.toggleHabit);
  const freezeStreak = useHomeStore((s) => s.freezeStreak);
  const removeHabit = useHomeStore((s) => s.removeHabit);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const handleAddHabit = (title: string) => {
    addHabit({
      title,
      frequency: 'daily',
      linkedGoalId: selectedGoalId,
    });
    setAddModalVisible(false);
    setSelectedGoalId(null);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Hábitos (Combustible) ⚡</Text>
          <Text style={styles.subtitle}>
            Acciones diarias que alimentan tus grandes metas.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {habits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="repeat-outline" size={40} color={colors.secondary} />
          <Text style={styles.emptyTitle}>Sin hábitos aún</Text>
          <Text style={styles.emptySub}>
            Construye la consistencia diaria que alimenta tu meta universitaria.
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.createBtnText}>Crear primer hábito</Text>
          </TouchableOpacity>
        </View>
      ) : (
        habits.map((habit) => {
          const linkedGoal = goals.find((g) => g.id === habit.linkedGoalId);
          const isFrozen = habit.frozenUntil === localDateKey();

          return (
            <View key={habit.id} style={styles.habitCard}>
              <View style={styles.cardRow}>
                <TouchableOpacity
                  style={[
                    styles.checkBtn,
                    habit.completed && { backgroundColor: colors.secondary },
                  ]}
                  onPress={() => {
                    toggleHabit(habit.id);
                    if (!habit.completed) {
                      celebrate({
                        kind: 'habit',
                        subtitle: linkedGoal
                          ? `+5 XP · Meta "${linkedGoal.title}" avanzó +2%`
                          : `+5 XP · ${habit.title}`,
                      });
                    }
                  }}
                >
                  <Ionicons
                    name={habit.completed ? 'checkmark' : 'ellipse-outline'}
                    size={20}
                    color={habit.completed ? colors.onSecondary : colors.outline}
                  />
                </TouchableOpacity>

                <View style={styles.infoCol}>
                  <Text
                    style={[
                      styles.habitTitle,
                      habit.completed && styles.habitDone,
                    ]}
                  >
                    {habit.title}
                  </Text>

                  {/* Vínculo a Meta */}
                  {linkedGoal ? (
                    <View style={styles.linkBadge}>
                      <Ionicons name="link" size={12} color={colors.primary} />
                      <Text style={styles.linkText}>
                        Alimenta: {linkedGoal.title} (+2% / día)
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.noLinkText}>Sin meta vinculada</Text>
                  )}
                </View>

                {/* Racha y Congelador */}
                <View style={styles.rightCol}>
                  <View style={styles.streakBadge}>
                    <Ionicons
                      name={isFrozen ? 'snow' : 'flame'}
                      size={14}
                      color={isFrozen ? colors.primary : colors.flame}
                    />
                    <Text style={styles.streakText}>{habit.streak}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.freezeBtn}
                    onPress={() => freezeStreak(habit.id)}
                    accessibilityLabel="Modo Reducción de Daño"
                  >
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.outline} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => removeHabit(habit.id)}>
                    <Ionicons name="trash-outline" size={16} color={colors.outline} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      )}

      {/* Modal Nuevo Hábito */}
      <PromptModal
        visible={addModalVisible}
        title="Nuevo Hábito Diario"
        hint="Define una pequeña acción repetible (ej. Estudiar C++ 20 min):"
        placeholder="Ej. Repasar 20 min al día"
        validate={(v) => (v ? null : 'Ingresa un título')}
        onSubmit={handleAddHabit}
        onCancel={() => setAddModalVisible(false)}
      />
    </ScrollView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl + 72,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    title: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
    },
    subtitle: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 20,
      padding: SPACING.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginTop: SPACING.md,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.onSurface,
      marginTop: SPACING.md,
    },
    emptySub: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: SPACING.lg,
    },
    createBtn: {
      backgroundColor: colors.secondary,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: 12,
    },
    createBtnText: {
      color: colors.onSecondary,
      fontWeight: '800',
      fontSize: 14,
    },
    habitCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.sm,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    checkBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoCol: {
      flex: 1,
    },
    habitTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.onSurface,
    },
    habitDone: {
      color: colors.onSurfaceVariant,
      textDecorationLine: 'line-through',
    },
    linkBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    linkText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    noLinkText: {
      fontSize: 11,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    rightCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs + 2,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    streakText: {
      fontSize: 13,
      fontWeight: '900',
      color: colors.flame,
    },
    freezeBtn: {
      padding: 4,
    },
  });
