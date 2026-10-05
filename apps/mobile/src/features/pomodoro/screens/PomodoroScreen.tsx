import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@/shared/ui/Ionicons';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SCREEN_MAX_CONTENT_WIDTH,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { PromptModal } from '@/shared/ui/PromptModal';
import { useI18n } from '@/shared/i18n/i18n';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/shared/infrastructure/notifications';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import type { RootStackParamList } from '@/shared/navigation/types';
import { completeFocusTarget, resolveFocusTarget } from '@/shared/focus/completeFocusTarget';
import { sameFocusTarget } from '@/shared/focus/focusFlow';
import { usePomodoroEngine } from '../hooks/usePomodoroEngine';
import {
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  usePomodoroStore,
} from '../store/usePomodoroStore';

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

type PomodoroRoute = RouteProp<RootStackParamList, 'Pomodoro'>;

export const PomodoroScreen = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const engine = usePomodoroEngine();
  const route = useRoute<PomodoroRoute>();
  const navigation = useNavigation();

  const minutes = usePomodoroStore((s) => s.minutes);
  const notifyOnComplete = usePomodoroStore((s) => s.notifyOnComplete);
  const setNotifyOnComplete = usePomodoroStore((s) => s.setNotifyOnComplete);
  const setMinutes = usePomodoroStore((s) => s.setMinutes);
  const running = usePomodoroStore((s) => s.running);
  const targetEndTime = usePomodoroStore((s) => s.targetEndTime);
  const secondsLeft = usePomodoroStore((s) => s.secondsLeft);
  const sessions = usePomodoroStore((s) => s.sessions);
  const focusTarget = usePomodoroStore((s) => s.focusTarget);

  // Se suscribe a metas y hábitos para que el título enfocado se actualice
  // cuando el paso se complete desde otra pantalla (Hoy, Metas, Hábitos).
  useProductivityStore((s) => s.goals);
  useProductivityStore((s) => s.habits);

  const [configVisible, setConfigVisible] = useState(false);
  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState('');
  // Guarda el resultado del toque en Marcar paso: así un doble toque no
  // reintenta el dominio (que de por sí ya es idempotente).
  const [targetResult, setTargetResult] = useState<string | null>(null);

  // El parámetro de navegación sólo fija el objetivo en reposo: a media sesión
  // se ignora para no mezclar pasos, y sin parámetro se conserva el guardado
  // (cerrar/reabrir no pierde el target porque vive persistido en el store).
  const routeTarget = route.params?.target ?? null;
  useEffect(() => {
    if (!routeTarget) return;
    if (usePomodoroStore.getState().running) return;
    if (sameFocusTarget(usePomodoroStore.getState().focusTarget, routeTarget)) return;
    usePomodoroStore.getState().setFocusTarget(routeTarget);
    setTargetResult(null);
  }, [routeTarget]);

  // Si cambia el objetivo (nuevo Enfocar o limpieza), se resetea el aviso local.
  useEffect(() => {
    setTargetResult(null);
  }, [focusTarget]);

  const fullSeconds = minutes * 60;
  const remainingSeconds = running
    ? Math.max(0, Math.ceil(((targetEndTime ?? Date.now()) - Date.now()) / 1000))
    : secondsLeft;

  const state: 'running' | 'paused' | 'completed' | 'idle' = running
    ? 'running'
    : secondsLeft <= 0
      ? 'completed'
      : secondsLeft < fullSeconds
        ? 'paused'
        : 'idle';

  const caption =
    state === 'running'
      ? t('pomodoro.cardActive')
      : state === 'completed'
        ? t('pomodoro.completed')
        : state === 'paused'
          ? t('pomodoro.paused')
          : t('pomodoro.cardIdle', { minutes });

  const sessionsLabel =
    sessions === 1
      ? t('pomodoro.sessionsTodayOne')
      : t('pomodoro.sessionsTodayMany', { count: sessions });

  // Acá se lee el contexto mínimo del paso (título y meta madre) con la misma
  // función que usa el resto de la app: nada de lógica duplicada.
  const focusInfo = focusTarget ? resolveFocusTarget(focusTarget) : null;

  const handleCompleteTarget = useCallback(() => {
    const current = usePomodoroStore.getState().focusTarget;
    if (!current) return;
    // Si el dominio ya lo ve listo, no se reintenta: se refleja como listo.
    const resolved = resolveFocusTarget(current);
    if (resolved.status === 'done') {
      setTargetResult('already_done');
      return;
    }
    if (resolved.status === 'missing') {
      setTargetResult('missing');
      return;
    }
    setTargetResult(completeFocusTarget(current));
  }, []);

  const targetDone =
    focusInfo?.status === 'done' || targetResult === 'completed' || targetResult === 'already_done';

  const handleBackToday = useCallback(() => {
    // Volver a Hoy muestra el estado ya actualizado: la sesión quedó en el
    // historial y el paso (si se marcó) ya no sale como pendiente.
    const parent = navigation.getParent();
    if (parent) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home' as never);
  }, [navigation]);

  // Al abrir, refleja revocaciones del permiso hechas en los ajustes del sistema.
  useEffect(() => {
    if (!notifyOnComplete) return;
    void getNotificationPermission().then((permission) => {
      if (permission !== 'granted') setNotifyOnComplete(false);
    });
  }, [notifyOnComplete, setNotifyOnComplete]);

  const validateMinutes = useCallback(
    (value: string): string | null => {
      const parsed = Number.parseInt(value, 10);
      if (
        !Number.isFinite(parsed) ||
        parsed < POMODORO_MIN_MINUTES ||
        parsed > POMODORO_MAX_MINUTES
      ) {
        return t('pomodoro.configError');
      }
      return null;
    },
    [t],
  );

  const applyMinutes = useCallback(
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) setMinutes(parsed);
      setConfigVisible(false);
    },
    [setMinutes],
  );

  const openNotify = useCallback(() => {
    setNotifyError('');
    setNotifyVisible(true);
  }, []);

  const disableNotify = useCallback(() => {
    setNotifyOnComplete(false);
    setNotifyError('');
  }, [setNotifyOnComplete]);

  const enableNotify = useCallback(async () => {
    setNotifyBusy(true);
    setNotifyError('');
    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        setNotifyError(
          permission === 'blocked' ? t('pomodoro.notifyBlocked') : t('pomodoro.notifyDenied'),
        );
        return;
      }
      setNotifyOnComplete(true);
      setNotifyVisible(false);
    } catch {
      setNotifyError(t('pomodoro.notifyError'));
    } finally {
      setNotifyBusy(false);
    }
  }, [setNotifyOnComplete, t]);

  const locked = state === 'running';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View testID="pomodoro-focus-card" style={styles.focusCard}>
        <Text style={styles.focusEyebrow}>{t('pomodoro.focusLabel')}</Text>
        {!focusTarget || !focusInfo ? (
          <Text style={styles.focusFree}>{t('pomodoro.freeSession')}</Text>
        ) : focusInfo.status === 'missing' ? (
          <Text style={styles.focusFree}>{t('pomodoro.focusMissing')}</Text>
        ) : (
          <>
            <Text testID="pomodoro-focus-title" style={styles.focusTitle} numberOfLines={2}>
              {focusInfo.title}
            </Text>
            {focusInfo.parentTitle ? (
              <Text style={styles.focusParent} numberOfLines={1}>
                {focusInfo.parentTitle}
              </Text>
            ) : null}
            {targetDone ? (
              <Text testID="pomodoro-focus-done" style={styles.focusDone}>
                {t('pomodoro.focusDone')}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.hero}>
        <Text style={styles.timer}>{formatTime(remainingSeconds)}</Text>
        <Text style={styles.caption}>{caption}</Text>
        {sessions > 0 ? <Text style={styles.sessionsText}>{sessionsLabel}</Text> : null}
      </View>

      <View style={styles.actionsRow}>
        {state === 'running' ? (
          <>
            <TouchableOpacity
              testID="pomodoro-pause"
              style={[styles.action, styles.actionPrimary]}
              onPress={engine.pause}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="pause" size={20} color={colors.onPrimary} />
              <Text style={styles.actionPrimaryText}>{t('pomodoro.pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pomodoro-reset"
              style={[styles.action, styles.actionGhost]}
              onPress={engine.reset}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={19} color={colors.primary} />
              <Text style={styles.actionGhostText}>{t('pomodoro.reset')}</Text>
            </TouchableOpacity>
          </>
        ) : state === 'paused' ? (
          <>
            <TouchableOpacity
              testID="pomodoro-resume"
              style={[styles.action, styles.actionPrimary]}
              onPress={engine.resume}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={20} color={colors.onPrimary} />
              <Text style={styles.actionPrimaryText}>{t('pomodoro.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pomodoro-reset"
              style={[styles.action, styles.actionGhost]}
              onPress={engine.reset}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={19} color={colors.primary} />
              <Text style={styles.actionGhostText}>{t('pomodoro.reset')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            testID="pomodoro-start"
            style={[styles.action, styles.actionPrimary]}
            onPress={engine.start}
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={22} color={colors.onPrimary} />
            <Text style={styles.actionPrimaryText}>{t('pomodoro.start')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {state === 'completed' ? (
        <View testID="pomodoro-complete-panel" style={styles.completePanel}>
          {focusTarget && focusInfo && focusInfo.status !== 'missing' && !targetDone ? (
            <TouchableOpacity
              testID="pomodoro-complete-target"
              style={[styles.action, styles.actionPrimary]}
              onPress={handleCompleteTarget}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
              <Text style={styles.actionPrimaryText}>{t('pomodoro.completeTarget')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID="pomodoro-back-today"
            style={[styles.action, styles.actionGhost]}
            onPress={handleBackToday}
            accessibilityRole="button"
            activeOpacity={0.8}
          >
            <Ionicons name="home-outline" size={19} color={colors.primary} />
            <Text style={styles.actionGhostText}>{t('pomodoro.backToday')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {locked ? <Text style={styles.lockedHint}>{t('pomodoro.lockedDuringSession')}</Text> : null}

      <View style={styles.settingsCard}>
        <TouchableOpacity
          testID="pomodoro-config-row"
          style={[styles.settingRow, locked && styles.settingRowLocked]}
          onPress={locked ? undefined : () => setConfigVisible(true)}
          disabled={locked}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <View style={styles.settingIcon}>
            <Ionicons name="time-outline" size={19} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>{t('pomodoro.configRow')}</Text>
            <Text style={styles.settingValue}>{t('pomodoro.configValue', { minutes })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />
        </TouchableOpacity>

        <View style={styles.settingDivider} />

        <TouchableOpacity
          testID="pomodoro-notify-row"
          style={[styles.settingRow, locked && styles.settingRowLocked]}
          onPress={locked ? undefined : notifyOnComplete ? disableNotify : openNotify}
          disabled={locked}
          accessibilityRole="button"
          accessibilityState={{ checked: notifyOnComplete }}
          activeOpacity={0.8}
        >
          <View style={styles.settingIcon}>
            <Ionicons
              name={notifyOnComplete ? 'notifications' : 'notifications-outline'}
              size={19}
              color={notifyOnComplete ? colors.primary : colors.onSurfaceVariant}
            />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingLabel}>{t('pomodoro.notifyRow')}</Text>
            <Text style={styles.settingValue}>
              {notifyOnComplete ? t('pomodoro.notifyOn') : t('pomodoro.notifyHint')}
            </Text>
          </View>
          <View style={[styles.toggleDot, notifyOnComplete && styles.toggleDotOn]} />
        </TouchableOpacity>
      </View>

      <PromptModal
        visible={configVisible}
        title={t('pomodoro.configTitle')}
        hint={t('pomodoro.configHint')}
        placeholder="25"
        initialValue={String(minutes)}
        keyboardType="number-pad"
        submitLabel={t('pomodoro.configApply')}
        cancelLabel={t('common.cancel')}
        validate={validateMinutes}
        onSubmit={applyMinutes}
        onCancel={() => setConfigVisible(false)}
        testID="pomodoro-config-modal"
      />

      <ConfirmModal
        visible={notifyVisible}
        title={t('pomodoro.notifyConfirmTitle')}
        message={t('pomodoro.notifyConfirmBody')}
        confirmLabel={t('pomodoro.notifyConfirmAction')}
        cancelLabel={t('common.cancel')}
        busy={notifyBusy}
        error={notifyError}
        onConfirm={() => void enableNotify()}
        onCancel={() => setNotifyVisible(false)}
      />
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    content: {
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xl,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING,
    },
    focusCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.md,
    },
    focusEyebrow: { ...type.labelSm, color: colors.primary, letterSpacing: 1.2 },
    focusTitle: { ...type.titleMd, color: colors.onSurface, marginTop: 4 },
    focusParent: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
    focusFree: { ...type.bodyMd, color: colors.onSurfaceVariant, marginTop: 4 },
    focusDone: { ...type.labelMd, color: colors.primary, marginTop: 4 },
    hero: {
      alignItems: 'center',
      marginTop: SPACING.lg,
      marginBottom: SPACING.xl,
    },
    timer: {
      ...type.headlineLg,
      fontSize: type.headlineLg.fontSize * 2,
      lineHeight: type.headlineLg.lineHeight * 2,
      color: colors.primary,
      fontVariant: ['tabular-nums'],
      letterSpacing: 1,
    },
    caption: {
      ...type.titleMd,
      color: colors.onSurface,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
    sessionsText: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: SPACING.sm,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    completePanel: {
      gap: SPACING.md,
      marginTop: SPACING.md,
    },
    action: {
      flex: 1,
      minHeight: 54,
      borderRadius: radius.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
    },
    actionPrimary: {
      backgroundColor: colors.primary,
    },
    actionPrimaryText: { ...type.labelLg, color: colors.onPrimary },
    actionGhost: {
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    actionGhostText: { ...type.labelLg, color: colors.primary },
    lockedHint: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.lg,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      minHeight: 68,
    },
    settingRowLocked: { opacity: 0.45 },
    settingIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingCopy: { flex: 1, minWidth: 0 },
    settingLabel: { ...type.titleSm, color: colors.onSurface },
    settingValue: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    settingDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant,
    },
    toggleDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.outline,
    },
    toggleDotOn: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
  });
};
