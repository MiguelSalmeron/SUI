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
import { PomodoroPanel } from '../../components/home/PomodoroPanel';
import { usePomodoroStore } from '../../store/usePomodoroStore';

export const PomodoroScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const pomodoroMinutes = usePomodoroStore((s) => s.pomodoroMinutes);
  const pomodoroSessions = usePomodoroStore((s) => s.pomodoroSessions);
  const pomodoroSeconds = usePomodoroStore((s) => s.pomodoroSeconds);
  const pomodoroRunning = usePomodoroStore((s) => s.pomodoroRunning);
  const pomodoroFullscreen = usePomodoroStore((s) => s.pomodoroFullscreen);
  const setPomodoroMinutes = usePomodoroStore((s) => s.setPomodoroMinutes);
  const setPomodoroSeconds = usePomodoroStore((s) => s.setPomodoroSeconds);
  const setPomodoroFullscreen = usePomodoroStore((s) => s.setPomodoroFullscreen);
  const startPomodoro = usePomodoroStore((s) => s.startPomodoro);
  const pausePomodoro = usePomodoroStore((s) => s.pausePomodoro);
  const resetPomodoro = usePomodoroStore((s) => s.resetPomodoro);

  const [configVisible, setConfigVisible] = useState(false);
  const [pomodoroMinutesInput, setPomodoroMinutesInput] = useState(String(pomodoroMinutes));

  const savePomodoroConfig = () => {
    const minutes = Number.parseInt(pomodoroMinutesInput, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      Alert.alert('Error', 'Ingresa minutos válidos entre 1 y 180');
      return;
    }
    setPomodoroMinutes(minutes);
    setPomodoroSeconds(minutes * 60);
    pausePomodoro();
    setConfigVisible(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <PomodoroPanel
        minutes={pomodoroMinutes}
        seconds={pomodoroSeconds}
        running={pomodoroRunning}
        sessions={pomodoroSessions}
        fullscreenVisible={pomodoroFullscreen}
        onStart={startPomodoro}
        onPause={pausePomodoro}
        onReset={resetPomodoro}
        onConfigure={() => setConfigVisible(true)}
        onCloseFullscreen={() => setPomodoroFullscreen(false)}
      />

      <Modal visible={configVisible} transparent animationType="fade" onRequestClose={() => setConfigVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configurar Pomodoro</Text>
            <Text style={styles.modalHint}>Define una duración entre 1 y 180 minutos.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="25"
              keyboardType="number-pad"
              value={pomodoroMinutesInput}
              onChangeText={setPomodoroMinutesInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => setConfigVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar configuración de pomodoro"
              >
                <Text style={styles.secondaryActionText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={savePomodoroConfig}
                accessibilityRole="button"
                accessibilityLabel="Guardar configuración de pomodoro"
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
    modalHint: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginBottom: SPACING.md,
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
