import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../theme/theme';
import { HomeListSection } from '../../components/home/HomeListSection';
import { PromptModal } from '../../components/ui/PromptModal';
import { useHomeStore } from '../../store/useHomeStore';
import { useCelebrationStore } from '../../store/useCelebrationStore';

export const GoalsScreen = () => {
  const celebrate = useCelebrationStore((s) => s.trigger);

  const goals = useHomeStore((s) => s.goals);
  const addGoal = useHomeStore((s) => s.addGoal);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);
  const removeGoal = useHomeStore((s) => s.removeGoal);

  const [modalVisible, setModalVisible] = useState(false);

  const handleAdd = (value: string) => {
    addGoal(value);
    setModalVisible(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HomeListSection
        title="Metas"
        subtitle="Enfoca tus objetivos principales del día."
        emptyText="No hay metas todavía. Agrega tu primera meta para empezar."
        items={goals}
        accent="primary"
        addLabel="Agregar meta"
        onAdd={() => setModalVisible(true)}
        onToggle={toggleGoal}
        onRemove={removeGoal}
        onItemCompleted={(title) =>
          celebrate({ kind: 'goal', subtitle: `+10 XP · ${title}` })
        }
      />

      <PromptModal
        visible={modalVisible}
        title="Nueva meta"
        placeholder="Ej. Terminar el proyecto"
        validate={(v) => (v ? null : 'Escribe un texto antes de guardar')}
        onSubmit={handleAdd}
        onCancel={() => setModalVisible(false)}
        testID="goal-prompt-modal"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 72,
  },
});
