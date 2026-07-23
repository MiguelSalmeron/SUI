import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACING } from '../../theme/theme';
import { PomodoroPanel } from '../../components/home/PomodoroPanel';
import { PromptModal } from '../../components/ui/PromptModal';
import { usePomodoroStore } from '../../store/usePomodoroStore';

export const PomodoroScreen = () => {
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

  const handleSaveConfig = (value: string) => {
    const minutes = Number.parseInt(value, 10);
    setPomodoroMinutes(minutes);
    setPomodoroSeconds(minutes * 60);
    pausePomodoro();
    setConfigVisible(false);
  };

  const validateMinutes = (value: string): string | null => {
    const minutes = Number.parseInt(value, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      return 'Ingresa minutos válidos entre 1 y 180';
    }
    return null;
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

      <PromptModal
        visible={configVisible}
        title="Configurar Pomodoro"
        hint="Define una duración entre 1 y 180 minutos."
        placeholder="25"
        initialValue={String(pomodoroMinutes)}
        keyboardType="number-pad"
        validate={validateMinutes}
        onSubmit={handleSaveConfig}
        onCancel={() => setConfigVisible(false)}
        testID="pomodoro-config-modal"
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
