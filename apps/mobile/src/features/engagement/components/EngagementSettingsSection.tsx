import { useMemo } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';
import { requestNotificationPermission } from '@/shared/infrastructure/notifications';
import type { EngagementCadence } from '../model/engagementTypes';
import { CADENCE_ORDER } from '../model/cadencePolicy';
import { useEngagementStore } from '../store/useEngagementStore';
import { cancelAllEngagementNotifications } from '../services/engagementScheduler';
import { reconcileEngagement } from '../services/engagementReconciler';

/**
 * Ajustes → Acompañamiento. Interruptor global opt-in (independiente del
 * permiso técnico), cadencia, adaptación y relleno ambiental. Se renderiza
 * como filas dentro de una `Section` de Ajustes.
 */
export const EngagementSettingsSection = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const profile = useEngagementStore((state) => state.profile);
  const updateProfile = useEngagementStore((state) => state.updateProfile);

  const setEnabled = async (value: boolean) => {
    // Activar es la acción explícita que habilita pedir el permiso técnico
    // (misma regla que el recordatorio nocturno). Sin permiso no se enciende,
    // así la UI nunca promete avisos que el sistema no va a entregar.
    if (value) {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        await updateProfile({ enabled: false });
        return;
      }
    }
    await updateProfile({ enabled: value });
    if (value) await reconcileEngagement();
    else await cancelAllEngagementNotifications();
  };

  const setCadence = async (cadence: EngagementCadence) => {
    await updateProfile({ cadence });
    if (profile.enabled) await reconcileEngagement();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.rowTitle}>{t('engagement.settings.enabledTitle')}</Text>
          <Text style={styles.rowBody}>{t('engagement.settings.enabledBody')}</Text>
        </View>
        <Switch
          value={profile.enabled}
          onValueChange={(value) => void setEnabled(value)}
          accessibilityLabel={t('engagement.settings.enabledTitle')}
        />
      </View>
      <Text style={styles.hint}>{t('engagement.settings.enabledHint')}</Text>

      {profile.enabled ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.rowTitle}>{t('engagement.settings.cadenceTitle')}</Text>
          <Text style={styles.rowBody}>{t('engagement.settings.cadenceBody')}</Text>
          <View style={styles.wrappedOptionsRow}>
            {CADENCE_ORDER.map((value) => {
              const selected = profile.cadence === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => void setCadence(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {t(`engagement.cadence.${value}` as never)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.rowTitle}>{t('engagement.settings.adaptiveTitle')}</Text>
              <Text style={styles.rowBody}>{t('engagement.settings.adaptiveBody')}</Text>
            </View>
            <Switch
              value={profile.adaptive}
              onValueChange={(value) => void updateProfile({ adaptive: value })}
              accessibilityLabel={t('engagement.settings.adaptiveTitle')}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.rowTitle}>{t('engagement.settings.ambientTitle')}</Text>
              <Text style={styles.rowBody}>{t('engagement.settings.ambientBody')}</Text>
            </View>
            <Switch
              value={profile.fillAmbient}
              onValueChange={(value) => void updateProfile({ fillAmbient: value })}
              accessibilityLabel={t('engagement.settings.ambientTitle')}
            />
          </View>
        </>
      ) : null}

      <View style={styles.summaryRow}>
        <Ionicons name="sparkles-outline" size={17} color={theme.colors.primary} />
        <Text style={styles.hint}>{t('engagement.settings.summary')}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    wrapper: { gap: SPACING.xs },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    switchCopy: { flex: 1 },
    rowTitle: { ...type.titleSm, color: colors.onSurface },
    rowBody: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
    hint: { ...type.bodySm, color: colors.onSurfaceVariant },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: SPACING.sm },
    wrappedOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.xs,
    },
    option: {
      minHeight: 44,
      minWidth: '45%',
      flexGrow: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
    },
    optionSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant },
    optionTextSelected: { color: colors.onPrimaryContainer },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
    },
  });
};
