import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { buildEmotionalProfile } from '../../services/chatPrompt';
import { buildReportPayload, DayStats, summarizeStats } from '../../services/reportPrompt';
import { streamChat, StreamController } from '../../services/chatStream';

type Status = 'loading' | 'streaming' | 'done' | 'error';

type Props = {
  visible: boolean;
  stats: DayStats;
  onClose: () => void;
};

/** Mensaje de respaldo cuando no hay internet / proxy (NUNCA spinner infinito). */
const offlineMessage = (stats: DayStats): string => {
  const { done, total, percent } = summarizeStats(stats);
  if (total === 0) {
    return 'Hoy no registraste metas, y está bien. Mañana es una nueva oportunidad para empezar con calma. Sui te espera. 🌙';
  }
  return (
    `Cerraste el día con ${done} de ${total} (${percent}%). ` +
    'Cada paso cuenta, incluso los pequeños. Descansa, mañana seguimos juntos. 🌙'
  );
};

/**
 * Reporte nocturno EFÍMERO. Al abrirse consulta a la IA (vía proxy) con las
 * estadísticas del día y hace streaming del resumen. No se persiste: al cerrar
 * desaparece. Si no hay red, muestra un cierre local cálido.
 */
export const NightlyReportModal = ({ visible, stats, onClose }: Props) => {
  const profile = useOnboardingStore((s) => s.profile);
  const selectedGoals = useOnboardingStore((s) => s.selectedGoals);

  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('loading');
  const controllerRef = useRef<StreamController | null>(null);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setText('');
    setStatus('loading');

    const emotional = buildEmotionalProfile(profile, selectedGoals);
    const payload = buildReportPayload(emotional, stats);

    streamChat(payload, {
      onChunk: (delta) => {
        if (!active) return;
        setStatus('streaming');
        setText((prev) => prev + delta);
      },
      onDone: () => {
        if (active) setStatus('done');
      },
      onError: () => {
        if (!active) return;
        setText(offlineMessage(stats));
        setStatus('error');
      },
    }).then((controller) => {
      controllerRef.current = controller;
    });

    return () => {
      active = false;
      controllerRef.current?.cancel();
      controllerRef.current = null;
    };
    // stats es estable durante la vida del modal abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const busy = status === 'loading';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Tu cierre de hoy</Text>
          <Text style={styles.subtitle}>Un resumen reflexivo de tu día</Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.loadingText}>Sui está preparando tu resumen…</Text>
              </View>
            ) : (
              <Text style={styles.reportText}>
                {text}
                {status === 'streaming' ? ' ▍' : ''}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  body: {
    maxHeight: 320,
  },
  bodyContent: {
    paddingVertical: SPACING.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  reportText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  closeButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 16,
  },
});
