import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';

type Props = {
  minutes: number;
  seconds: number;
  running: boolean;
  sessions: number;
  fullscreenVisible: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onConfigure: () => void;
  onCloseFullscreen: () => void;
};

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const PomodoroPanel = ({
  minutes,
  seconds,
  running,
  sessions,
  fullscreenVisible,
  onStart,
  onPause,
  onReset,
  onConfigure,
  onCloseFullscreen,
}: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.sectionSpacing}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Pomodoro</Text>
        <Text style={styles.sectionSubtitle}>Configura tu tiempo y entra en modo enfoque.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.timer}>{formatTime(seconds)}</Text>
        <Text style={styles.cardText}>{running ? 'Sesión activa' : 'Listo para comenzar una nueva sesión'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Text style={styles.metaLabel}>Duración</Text>
            <Text style={styles.metaValue}>{minutes} min</Text>
          </View>
          <View style={styles.metaChip}>
            <Text style={styles.metaLabel}>Sesiones</Text>
            <Text style={styles.metaValue}>{sessions}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Abrir pomodoro en pantalla completa"
          >
            <Text style={styles.primaryActionText}>Fullscreen</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={onConfigure}
            accessibilityRole="button"
            accessibilityLabel="Configurar duración del pomodoro"
          >
            <Text style={styles.secondaryActionText}>Configurar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.ghostAction}
            onPress={onPause}
            accessibilityRole="button"
            accessibilityLabel={running ? 'Pausar pomodoro' : 'Reanudar pomodoro'}
          >
            <Text style={styles.ghostActionText}>{running ? 'Pausar' : 'Reanudar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ghostAction}
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel="Reiniciar pomodoro"
          >
            <Text style={styles.ghostActionText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={fullscreenVisible} animationType="fade" onRequestClose={onCloseFullscreen}>
        <View style={styles.fullscreenShell}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity onPress={onCloseFullscreen} accessibilityRole="button" accessibilityLabel="Cerrar pantalla completa">
              <Text style={styles.fullscreenAction}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onReset} accessibilityRole="button" accessibilityLabel="Reiniciar pomodoro">
              <Text style={styles.fullscreenAction}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fullscreenBody}>
            <Text style={styles.fullscreenKicker}>Modo enfoque</Text>
            <Text style={styles.fullscreenTimer}>{formatTime(seconds)}</Text>
            <Text style={styles.fullscreenMeta}>Duración: {minutes} minutos</Text>
            <Text style={styles.fullscreenMeta}>Sesiones completadas: {sessions}</Text>

            <View style={styles.fullscreenButtons}>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={onPause}
                accessibilityRole="button"
                accessibilityLabel={running ? 'Pausar pomodoro' : 'Reanudar pomodoro'}
              >
                <Text style={styles.secondaryActionText}>{running ? 'Pausar' : 'Reanudar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={onStart}
                accessibilityRole="button"
                accessibilityLabel="Continuar pomodoro"
              >
                <Text style={styles.primaryActionText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: colors.onSurfaceVariant,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 16,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  timer: {
    fontSize: 46,
    fontWeight: '900',
    textAlign: 'center',
    color: colors.primary,
    marginBottom: SPACING.sm,
  },
  cardText: {
    fontSize: 15,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  metaChip: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  metaLabel: {
    color: colors.onSurfaceVariant,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  metaValue: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.secondary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: colors.onSecondary,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.onPrimary,
    fontWeight: '800',
  },
  ghostAction: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  ghostActionText: {
    color: colors.primary,
    fontWeight: '800',
  },
  fullscreenShell: {
    flex: 1,
    backgroundColor: colors.inverseSurface,
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullscreenAction: {
    color: colors.inverseOnSurface,
    fontSize: 16,
    fontWeight: '800',
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenKicker: {
    color: colors.inversePrimary,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  fullscreenTimer: {
    color: colors.inverseOnSurface,
    fontSize: 78,
    fontWeight: '900',
    letterSpacing: 2,
  },
  fullscreenMeta: {
    color: colors.inverseOnSurface,
    fontSize: 16,
    marginTop: SPACING.sm,
    opacity: 0.8,
  },
  fullscreenButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    width: '100%',
  },
});
