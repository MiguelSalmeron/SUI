import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';

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
          <TouchableOpacity style={styles.primaryAction} onPress={onStart}>
            <Text style={styles.primaryActionText}>Fullscreen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryAction} onPress={onConfigure}>
            <Text style={styles.secondaryActionText}>Configurar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.ghostAction} onPress={onPause}>
            <Text style={styles.ghostActionText}>{running ? 'Pausar' : 'Reanudar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostAction} onPress={onReset}>
            <Text style={styles.ghostActionText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={fullscreenVisible} animationType="fade" onRequestClose={onCloseFullscreen}>
        <View style={styles.fullscreenShell}>
          <View style={styles.fullscreenHeader}>
            <TouchableOpacity onPress={onCloseFullscreen}>
              <Text style={styles.fullscreenAction}>Cerrar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onReset}>
              <Text style={styles.fullscreenAction}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fullscreenBody}>
            <Text style={styles.fullscreenKicker}>Modo enfoque</Text>
            <Text style={styles.fullscreenTimer}>{formatTime(seconds)}</Text>
            <Text style={styles.fullscreenMeta}>Duración: {minutes} minutos</Text>
            <Text style={styles.fullscreenMeta}>Sesiones completadas: {sessions}</Text>

            <View style={styles.fullscreenButtons}>
              <TouchableOpacity style={styles.secondaryAction} onPress={onPause}>
                <Text style={styles.secondaryActionText}>{running ? 'Pausar' : 'Reanudar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryAction} onPress={onStart}>
                <Text style={styles.primaryActionText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionSpacing: {
    marginTop: SPACING.md,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  timer: {
    fontSize: 46,
    fontWeight: '900',
    textAlign: 'center',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  cardText: {
    fontSize: 15,
    color: COLORS.textSecondary,
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
    borderRadius: 18,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  metaValue: {
    color: COLORS.text,
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
    backgroundColor: COLORS.secondary,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryActionText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  ghostAction: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ghostActionText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  fullscreenShell: {
    flex: 1,
    backgroundColor: COLORS.primary,
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
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },
  fullscreenBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenKicker: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  fullscreenTimer: {
    color: COLORS.white,
    fontSize: 78,
    fontWeight: '900',
    letterSpacing: 2,
  },
  fullscreenMeta: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: SPACING.sm,
    opacity: 0.94,
  },
  fullscreenButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    width: '100%',
  },
});
