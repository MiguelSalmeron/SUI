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
import type { Goal, GoalGravity } from '../../types/models';

export const GoalsScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const celebrate = useCelebrationStore((s) => s.trigger);

  const goals = useHomeStore((s) => s.goals);
  const addGoal = useHomeStore((s) => s.addGoal);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);
  const addMilestone = useHomeStore((s) => s.addMilestone);
  const toggleMilestone = useHomeStore((s) => s.toggleMilestone);
  const removeGoal = useHomeStore((s) => s.removeGoal);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addingMilestoneGoalId, setAddingMilestoneGoalId] = useState<string | null>(null);
  const [gravity, setGravity] = useState<GoalGravity>('high');

  const handleAddGoal = (title: string) => {
    const defaultDeadline = localDateKey(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    addGoal({
      title,
      deadline: defaultDeadline,
      gravity,
    });
    setAddModalVisible(false);
  };

  const handleAddMilestone = (title: string) => {
    if (addingMilestoneGoalId) {
      addMilestone(addingMilestoneGoalId, title);
      setAddingMilestoneGoalId(null);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Metas (Destino) 🎯</Text>
          <Text style={styles.subtitle}>
            Tus grandes objetivos con fecha límite e hitos.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Añadir nueva meta"
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      {goals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="trophy-outline" size={40} color={colors.primary} />
          <Text style={styles.emptyTitle}>Sin metas registradas</Text>
          <Text style={styles.emptySub}>
            Crea tu primer proyecto o examen por vencer para darle tracción a tu semestre.
          </Text>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setAddModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Crear primera meta"
          >
            <Text style={styles.createBtnText}>Crear primera meta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        goals.map((goal) => {
          const isRed = goal.gravity === 'high';
          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.gravityTag,
                    {
                      backgroundColor: isRed
                        ? colors.errorContainer
                        : colors.flameContainer,
                    },
                  ]}
                >
                  <Ionicons
                    name={isRed ? 'alarm' : 'document-text'}
                    size={16}
                    color={isRed ? colors.error : colors.flame}
                  />
                  <Text
                    style={[
                      styles.gravityText,
                      { color: isRed ? colors.error : colors.flame },
                    ]}
                  >
                    {isRed ? 'Examen / Crítico' : 'Tarea / Quiz'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => removeGoal(goal.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar meta ${goal.title}`}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.outline} />
                </TouchableOpacity>
              </View>

              <Text style={styles.goalTitle}>{goal.title}</Text>
              <Text style={styles.goalDeadline}>
                📅 Vence: {goal.deadline}
              </Text>

              {/* Barra de Progreso */}
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${goal.progress}%`,
                        backgroundColor: goal.completed
                          ? colors.success
                          : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{goal.progress}%</Text>
              </View>

              {/* Hitos / Milestones Checklist */}
              {goal.milestones.length > 0 && (
                <View style={styles.milestoneList}>
                  {goal.milestones.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.milestoneRow}
                      onPress={() => {
                        toggleMilestone(goal.id, m.id);
                        if (!m.completed) {
                          celebrate({
                            kind: 'goal',
                            subtitle: `Hito cumplido · ${m.title}`,
                          });
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${m.completed ? 'Desmarcar' : 'Marcar'} hito ${m.title}`}
                    >
                      <Ionicons
                        name={m.completed ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={m.completed ? colors.primary : colors.outline}
                      />
                      <Text
                        style={[
                          styles.milestoneTitle,
                          m.completed && styles.milestoneDone,
                        ]}
                      >
                        {m.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.addMilestoneBtn}
                onPress={() => setAddingMilestoneGoalId(goal.id)}
                accessibilityRole="button"
                accessibilityLabel={`Agregar hito a la meta ${goal.title}`}
              >
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.addMilestoneText}>Agregar Hito / Checklist</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Modal Nueva Meta */}
      <PromptModal
        visible={addModalVisible}
        title="Nueva Meta Académica"
        hint="Crea un proyecto o examen por vencer. Elige tipo:"
        placeholder="Ej. Proyecto Final de Estructuras de Datos"
        validate={(v) => (v ? null : 'Ingresa un título')}
        onSubmit={handleAddGoal}
        onCancel={() => setAddModalVisible(false)}
      />

      {/* Modal Nuevo Hito */}
      <PromptModal
        visible={addingMilestoneGoalId !== null}
        title="Nuevo Hito para Meta"
        placeholder="Ej. Redactar marco teórico"
        validate={(v) => (v ? null : 'Ingresa un hito')}
        onSubmit={handleAddMilestone}
        onCancel={() => setAddingMilestoneGoalId(null)}
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
      backgroundColor: colors.primary,
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
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm + 2,
      borderRadius: 12,
    },
    createBtnText: {
      color: colors.onPrimary,
      fontWeight: '800',
      fontSize: 14,
    },
    goalCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 20,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      marginBottom: SPACING.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    gravityTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    gravityText: {
      fontSize: 11,
      fontWeight: '800',
    },
    goalTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: colors.onSurface,
      marginTop: 4,
    },
    goalDeadline: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
      marginTop: 2,
      marginBottom: SPACING.sm,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    progressTrack: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.outlineVariant,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 5,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '900',
      color: colors.primary,
    },
    milestoneList: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
      gap: 6,
    },
    milestoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: 2,
    },
    milestoneTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurface,
    },
    milestoneDone: {
      color: colors.onSurfaceVariant,
      textDecorationLine: 'line-through',
    },
    addMilestoneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    addMilestoneText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
  });
