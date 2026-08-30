import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import {
  buildEmotionalProfile,
  buildReportPayload,
  streamChat,
  summarizeStats,
  type DayStats,
  type StreamController,
} from '@/features/chat/public';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { useI18n } from '@/shared/i18n/i18n';
import type { TranslationKey } from '@/shared/i18n/translations';

type Status = 'loading' | 'streaming' | 'done' | 'error';

type Props = {
  visible: boolean;
  stats: DayStats;
  onClose: () => void;
};

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/** Mensaje de respaldo cuando no hay internet / proxy (NUNCA spinner infinito). */
const offlineMessage = (stats: DayStats, t: Translate): string => {
  const { done, total, percent } = summarizeStats(stats);
  if (total === 0) {
    return t('nightly.offlineEmpty');
  }
  return t('nightly.offlineSummary', { done, total, percent });
};

/**
 * Reporte nocturno EFÍMERO. Al abrirse consulta a la IA (vía proxy) con las
 * estadísticas del día y hace streaming del resumen. No se persiste: al cerrar
 * desaparece. Si no hay red, muestra un cierre local cálido.
 */
export const NightlyReportModal = ({ visible, stats, onClose }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const goals = useHomeStore((state) => state.goals);
  const { locale, t } = useI18n();

  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('loading');
  const controllerRef = useRef<StreamController | null>(null);

  useEffect(() => {
    if (!visible) return;

    let active = true;
    setText('');
    setStatus('loading');

    const emotional = buildEmotionalProfile({
      goals: goals
        .filter((goal) => !goal.completed)
        .slice(0, 3)
        .map((goal) => goal.title),
      locale,
    });
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
        setText(offlineMessage(stats, t));
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
    // stats y metas son estables durante la vida del modal abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, locale]);

  const busy = status === 'loading';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('nightly.title')}</Text>
          <Text style={styles.subtitle}>{t('nightly.subtitle')}</Text>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('nightly.loading')}</Text>
              </View>
            ) : (
              <Text style={styles.reportText}>
                {text}
                {status === 'streaming' ? ' ▍' : ''}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('nightly.closeLabel')}
          >
            <Text style={styles.closeButtonText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
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
      ...type.headlineSm,
      color: colors.onSurface,
    },
    subtitle: {
      ...type.bodyMd,
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
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
    },
    reportText: {
      ...type.bodyLg,
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
      ...type.titleMd,
      color: colors.onPrimary,
    },
  });
