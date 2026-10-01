import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';

export interface StarterSeedBannerProps {
  /** Títulos reales de lo sembrado, para que el aviso sea específico. */
  goalTitle?: string;
  habitTitle?: string;
  onPersonalize: () => void;
  onDismiss: () => void;
}

/**
 * Aviso de que el contenido de Inicio es un ejemplo.
 *
 * Se muestra solo mientras haya entidades sembradas sin tocar, y por eso las
 * dos salidas son distintas a propósito: *Personalizar* conserva el dato y lo
 * devuelve al estado normal, *Descartar* lo borra. Ese último nunca se
 * re-siembra porque el candado de `starterSeededAt` ya quedó marcado al crear.
 */
export const StarterSeedBanner = ({
  goalTitle,
  habitTitle,
  onPersonalize,
  onDismiss,
}: StarterSeedBannerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();

  const title = goalTitle ?? habitTitle ?? '';
  const icon: IoniconName = goalTitle ? 'flag-outline' : 'repeat';
  const label =
    goalTitle && habitTitle
      ? t('onboarding.seed.bannerLabelPlural')
      : t('onboarding.seed.bannerLabel');

  return (
    <View
      style={styles.banner}
      accessible
      accessibilityLabel={t('onboarding.seed.bannerA11y', { label, title })}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.actions}>
        <Text
          style={styles.action}
          onPress={onPersonalize}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.seed.personalizeA11y', { title })}
        >
          {t('onboarding.seed.personalize')}
        </Text>
        <Text
          style={styles.action}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.seed.dismissA11y', { title })}
        >
          {t('onboarding.seed.dismiss')}
        </Text>
      </View>
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceContainerLowest,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      padding: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    label: { ...type.labelSm, color: colors.onSurfaceVariant },
    title: { ...type.bodyMd, color: colors.onSurface },
    actions: { flexDirection: 'row', gap: SPACING.sm },
    action: { ...type.labelMd, color: colors.primary },
  });
