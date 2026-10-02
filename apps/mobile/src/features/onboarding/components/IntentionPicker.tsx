import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { UserIntention } from '@/shared/account/introTypes';
import { useI18n } from '@/shared/i18n/i18n';
import { STARTER_KITS } from '@/shared/domain/productivity/public';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { OnboardingButton, OnboardingEntrance } from './OnboardingMotion';

interface IntentionPickerProps {
  selected: UserIntention;
  onSelect: (intention: UserIntention) => void;
  onConfirm: () => void;
  /** Deshabilita el confirm mientras el paso anterior se anima. */
  busy?: boolean;
  active?: boolean;
}

const intentions: { id: UserIntention; icon: IoniconName }[] = [
  { id: 'goal', icon: 'flag-outline' },
  { id: 'habit', icon: 'repeat' },
  { id: 'agenda', icon: 'calendar-outline' },
  { id: 'explore', icon: 'compass-outline' },
];

/**
 * Selector de intención con vista previa de lo que se va a sembrar.
 *
 * La vista previa no es ilustrativa: muestra el título real del kit, resuelto
 * en el idioma actual. Lo que el usuario elige es exactamente lo que va a
 * encontrar en Inicio, y eso evita que la siembra se sienta como magia negra.
 */
export const IntentionPicker = ({
  selected,
  onSelect,
  onConfirm,
  busy = false,
  active = true,
}: IntentionPickerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();

  const kit = STARTER_KITS[selected];
  const previewGoal = kit.goals[0];
  const previewHabit = kit.habits[0];

  const choose = (intention: UserIntention) => {
    if (selected === intention) return;
    onSelect(intention);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    recordTelemetry('onboarding.intention_select', { intention });
  };

  return (
    <View>
      <Text style={styles.heading}>{t('onboarding.intentionTitle')}</Text>
      <View
        style={styles.grid}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('onboarding.intentionTitle')}
      >
        {intentions.map(({ id, icon }, index) => (
          <View key={id} style={styles.cell}>
            <OnboardingEntrance delay={180 + index * 60}>
              <OnboardingButton
                style={[styles.option, selected === id && styles.optionSelected]}
                onPress={() => choose(id)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${t(`onboarding.intentions.${id}`)}. ${t(`onboarding.intentions.${id}Desc`)}`}
                accessibilityState={{ selected: selected === id }}
              >
                <Ionicons name={icon} size={22} color={theme.colors.primary} />
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>{t(`onboarding.intentions.${id}`)}</Text>
                  {selected === id ? (
                    <Text style={styles.optionDescription}>
                      {t(`onboarding.intentions.${id}Desc`)}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.selectionMark}>
                  {selected === id ? (
                    <OnboardingEntrance key={id} duration={220}>
                      <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                    </OnboardingEntrance>
                  ) : null}
                </View>
              </OnboardingButton>
            </OnboardingEntrance>
          </View>
        ))}
      </View>

      <OnboardingEntrance delay={270}>
        <View style={styles.preview}>
          <Text style={styles.previewHeading}>{t('onboarding.seed.heading')}</Text>
          <OnboardingEntrance key={selected} duration={220}>
            <View style={styles.previewContent}>
              {previewGoal ? (
                <View style={styles.previewRow}>
                  <View style={styles.previewIcon}>
                    <Ionicons name="flag-outline" size={16} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.previewTitle}>{t(previewGoal.titleKey)}</Text>
                </View>
              ) : null}
              {previewHabit ? (
                <View style={styles.previewRow}>
                  <View style={styles.previewIcon}>
                    <Ionicons name="repeat" size={16} color={theme.colors.flame} />
                  </View>
                  <Text style={styles.previewTitle}>{t(previewHabit.titleKey)}</Text>
                </View>
              ) : null}
            </View>
          </OnboardingEntrance>
          <Text style={styles.previewHint}>{t('onboarding.seed.hint')}</Text>
        </View>

        <OnboardingButton
          style={styles.confirm}
          attention={active}
          onPress={onConfirm}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.confirmText}>{t('onboarding.seed.confirm')}</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
        </OnboardingButton>
      </OnboardingEntrance>
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    heading: {
      ...type.titleSm,
      color: colors.onSurface,
      marginTop: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    grid: {
      flexDirection: 'column',
      gap: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    cell: { width: '100%' },
    option: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      padding: SPACING.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainer,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryContainer },
    optionContent: { flex: 1, minWidth: 0 },
    selectionMark: { width: 22 },
    optionTitle: { ...type.labelLg, color: colors.onSurface },
    optionDescription: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: SPACING.xs },
    preview: {
      borderRadius: radius.lg,
      paddingVertical: SPACING.sm,
      marginTop: SPACING.xs,
    },
    previewHeading: { ...type.labelMd, color: colors.onSurface },
    previewContent: { gap: SPACING.xs, paddingTop: SPACING.xs },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    previewIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewTitle: { ...type.bodyMd, color: colors.onSurface, flex: 1 },
    previewHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: SPACING.xs },
    confirm: {
      minHeight: 52,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.lg,
      marginTop: SPACING.md,
    },
    confirmText: { ...type.labelLg, color: colors.onPrimary, flexShrink: 1, textAlign: 'center' },
  });
