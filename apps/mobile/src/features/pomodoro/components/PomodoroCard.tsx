import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';
import { getSessionMinutes, usePomodoroStore } from '../store/usePomodoroStore';

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

type Props = {
  onPress: () => void;
};

/**
 * Tarjeta de entrada a Pomodoro desde Inicio.
 *
 * Muestra el estado vivo de la sesión (en reposo con la duración, o la cuenta
 * regresiva restante cuando corre) y las sesiones de hoy. Tocar la tarjeta
 * abre la pantalla completa de sesión (ruta raíz `Pomodoro`).
 */
export const PomodoroCard = ({ onPress }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const minutes = usePomodoroStore(getSessionMinutes);
  const running = usePomodoroStore((s) => s.running);
  const targetEndTime = usePomodoroStore((s) => s.targetEndTime);
  const secondsLeft = usePomodoroStore((s) => s.secondsLeft);
  const sessions = usePomodoroStore((s) => s.sessions);

  // Al abrir Inicio sin motor montado, recalcula desde el fin absoluto para
  // no mostrar un valor congelado tras background o reinicio.
  const remainingSeconds = running
    ? Math.max(0, Math.ceil(((targetEndTime ?? Date.now()) - Date.now()) / 1000))
    : Math.max(secondsLeft, minutes * 60);

  const sessionsLabel =
    sessions === 1
      ? t('pomodoro.sessionsTodayOne')
      : t('pomodoro.sessionsTodayMany', { count: sessions });

  return (
    <TouchableOpacity
      testID="pomodoro-card"
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={t('pomodoro.openCard')}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="timer-outline" size={22} color={colors.onFlameContainer} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {t('pomodoro.title')}
          </Text>
          {sessions > 0 ? (
            <View style={styles.sessionsChip}>
              <Text style={styles.sessionsText} numberOfLines={1}>
                {sessionsLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.caption} numberOfLines={1}>
          {running ? t('pomodoro.cardActive') : t('pomodoro.cardIdle', { minutes })}
        </Text>
      </View>
      <View style={styles.timerRow}>
        {running ? <View style={styles.runningDot} /> : null}
        <Text style={[styles.timer, running && styles.timerActive]}>
          {formatTime(remainingSeconds)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type, elevation, scheme } = theme;
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      ...elevation.soft,
      borderWidth: scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.outlineVariant,
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.xl,
    },
    copy: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.flameContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...type.titleMd, color: colors.onSurface, flexShrink: 1 },
    sessionsChip: {
      flexShrink: 1,
      backgroundColor: colors.secondaryContainer,
      borderRadius: radius.full,
      paddingHorizontal: SPACING.sm,
      minHeight: 20,
      justifyContent: 'center',
    },
    sessionsText: { ...type.labelSm, color: colors.onSecondaryContainer },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    timer: { ...type.titleLg, color: colors.onSurface },
    timerActive: { color: colors.flame },
    runningDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.flame },
    caption: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
    },
  });
};
