import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { localDateKey } from '@/shared/domain/productivity/pure';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { Ionicons } from '@/shared/ui/Ionicons';

export interface ResumeNudgeProps {
  /** Último día con avance (`YYYY-MM-DD`). A2 lo pasa desde `useProductivityStore`. */
  lastCompletedDate?: string | null;
  /** A2 la conecta al paso 1 del plan. */
  onStart: () => void;
  /** Sólo para tests: fija el "hoy" sin tocar el reloj. */
  now?: Date;
}

/**
 * Días desde el último avance hasta hoy.
 *
 * Se calcula con `localDateKey` para que el corte sea la medianoche local del
 * teléfono, no UTC. Sin fecha o con fecha inválida devuelve `null`; hoy es 0
 * y ayer es 1. Sólo con 2 o más el aviso se muestra, sin hablar de rachas.
 */
export const getResumeGapDays = (
  lastCompletedDate?: string | null,
  now: Date = new Date(),
): number | null => {
  if (!lastCompletedDate) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastCompletedDate)) return null;
  const todayKey = localDateKey(now);
  if (lastCompletedDate === todayKey) return 0;
  const todayMidnight = new Date(`${todayKey}T00:00:00`);
  const lastMidnight = new Date(`${lastCompletedDate}T00:00:00`);
  if (!Number.isFinite(lastMidnight.getTime())) return null;
  const diffMs = todayMidnight.getTime() - lastMidnight.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return 0;
  return Math.round(diffMs / 86400000);
};

/**
 * Invitación a retomar cuando pasar varios días sin avanzar.
 *
 * Aparece sólo si `lastCompletedDate` es anterior a ayer. El descarte vive en
 * una variable de módulo (no persistida): vale para la sesión, se lee al
 * montar y se marca al tocar Empezar o cerrar.
 */
let resumeNudgeDismissedForSession = false;

export const ResumeNudge = ({ lastCompletedDate, onStart, now }: ResumeNudgeProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  // Se lee al montar: si ya se descartó en esta sesión, no vuelve a salir.
  const [dismissed, setDismissed] = useState(resumeNudgeDismissedForSession);
  const gapDays = useMemo(
    () => getResumeGapDays(lastCompletedDate, now ?? new Date()),
    [lastCompletedDate, now],
  );

  if (dismissed || gapDays === null || gapDays < 2) return null;

  const body = t('settings.resumeNudge.body', { days: gapDays });
  // Empezar avisa a A2 y marca el descarte para la sesión.
  const dismissForSession = () => {
    resumeNudgeDismissedForSession = true;
    setDismissed(true);
  };
  const handleStart = () => {
    dismissForSession();
    onStart();
  };

  return (
    <View style={styles.card} testID="resume-nudge">
      <View
        style={styles.iconCircle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Ionicons name="leaf-outline" size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primary}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel={t('settings.resumeNudge.start')}
          >
            <Text style={styles.primaryText}>{t('settings.resumeNudge.start')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismiss}
            onPress={dismissForSession}
            accessibilityRole="button"
            accessibilityLabel={t('settings.resumeNudge.dismiss')}
          >
            <Text style={styles.dismissText}>{t('settings.resumeNudge.dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = ({ colors, radius, type, elevation, scheme }: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: radius.xl,
      ...elevation.soft,
      borderWidth: scheme === 'dark' ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.outlineVariant,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    copy: { flex: 1 },
    body: { ...type.bodyMd, color: colors.onSurface },
    actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
    primary: {
      minHeight: 44,
      minWidth: 44,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.md,
    },
    primaryText: { ...type.labelLg, color: colors.onPrimary },
    dismiss: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
    },
    dismissText: { ...type.labelMd, color: colors.primary },
  });
