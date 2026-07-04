import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
import { HomeListSection } from '../../components/home/HomeListSection';
import { useHomeStore } from '../../store/useHomeStore';

export const GoalsScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useHomeStore((s) => s.goals);
  const addGoal = useHomeStore((s) => s.addGoal);
  const toggleGoal = useHomeStore((s) => s.toggleGoal);
  const removeGoal = useHomeStore((s) => s.removeGoal);

  const [modalVisible, setModalVisible] = useState(false);
  const [itemTitle, setItemTitle] = useState('');

  const handleOpen = () => {
    setItemTitle('');
    setModalVisible(true);
  };

  const handleAdd = () => {
    if (!itemTitle.trim()) {
      Alert.alert('Error', 'Escribe un texto antes de guardar');
      return;
    }
    addGoal(itemTitle);
    setModalVisible(false);
    setItemTitle('');
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
        onAdd={handleOpen}
        onToggle={toggleGoal}
        onRemove={removeGoal}
      />

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva meta</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej. Terminar el proyecto"
              value={itemTitle}
              onChangeText={setItemTitle}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text style={styles.secondaryActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={handleAdd}
                accessibilityRole="button"
                accessibilityLabel="Guardar"
              >
                <Text style={styles.primaryActionText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl + 72,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: SPACING.lg,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.onSurface,
      marginBottom: SPACING.sm,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: SPACING.md,
      fontSize: 16,
      color: colors.onSurface,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: SPACING.lg,
    },
    primaryAction: {
      backgroundColor: colors.secondary,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: 16,
      alignItems: 'center',
      flex: 1,
    },
    primaryActionText: {
      color: colors.surface,
      fontWeight: '800',
      fontSize: 15,
    },
    secondaryAction: {
      backgroundColor: colors.background,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      flex: 1,
    },
    secondaryActionText: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 15,
    },
  });
