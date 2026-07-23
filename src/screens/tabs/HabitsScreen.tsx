import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../theme/theme';
import { HomeListSection } from '../../components/home/HomeListSection';
import { PromptModal } from '../../components/ui/PromptModal';
import { useHomeStore } from '../../store/useHomeStore';
import { useCelebrationStore } from '../../store/useCelebrationStore';

export const HabitsScreen = () => {
  const celebrate = useCelebrationStore((s) => s.trigger);

  const habits = useHomeStore((s) => s.habits);
  const addHabit = useHomeStore((s) => s.addHabit);
  const toggleHabit = useHomeStore((s) => s.toggleHabit);
  const removeHabit = useHomeStore((s) => s.removeHabit);

  const [modalVisible, setModalVisible] = useState(false);

  const handleAdd = (value: string) => {
    addHabit(value);
    setModalVisible(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <HomeListSection
        title="Hábitos"
        subtitle="Registra acciones pequeñas que puedas repetir a diario."
        emptyText="No hay hábitos registrados. Crea uno para empezar a seguir tu progreso."
        items={habits}
        accent="secondary"
        addLabel="Agregar hábito"
        onAdd={() => setModalVisible(true)}
        onToggle={toggleHabit}
        onRemove={removeHabit}
        onItemCompleted={(title) =>
          celebrate({ kind: 'habit', subtitle: `+5 XP · ${title}` })
        }
      />

      <PromptModal
        visible={modalVisible}
        title="Nuevo hábito"
        placeholder="Ej. Leer 20 minutos"
        validate={(v) => (v ? null : 'Escribe un texto antes de guardar')}
        onSubmit={handleAdd}
        onCancel={() => setModalVisible(false)}
        testID="habit-prompt-modal"
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
