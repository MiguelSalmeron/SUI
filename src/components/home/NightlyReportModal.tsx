import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ColorScheme, SPACING, useAppTheme } from '../../theme/theme';
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
    return 'Hoy no registraste metas, y está bien. Mañana es una nueva oportunidad para empezar con calma. Sui te espera.';
  }
  return (
    `Cerraste el día con ${done} de ${total} (${percent}%). ` +
    'Cada paso cuenta, incluso los pequeños. Descansa, mañana seguimos juntos.'
  );
};

/**
 * Reporte nocturno EFÍMERO. Al abrirse consulta a la IA (vía proxy) con las
 * estadísticas del día y hace streaming del resumen. No se persiste: al cerrar
 * desaparece. Si no hay red, muestra un cierre local cálido.
 */
export const NightlyReportModal = ({ visible, stats, onClose }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Sui está preparando tu resumen…</Text>
              </View>
            ) : (
              <Text style={styles.reportText}>
                {text}
                {status === 'streaming' ? ' ▍' : ''}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar resumen nocturno">
            <Text style={styles.closeButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.outlineVariant,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 14,
    color: colors.onSurfaceVariant,
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
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },
  reportText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.onSurface,
  },
  closeButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  closeButtonText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
});
