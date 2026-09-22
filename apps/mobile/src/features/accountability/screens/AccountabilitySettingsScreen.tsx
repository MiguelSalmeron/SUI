import { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SCREEN_MAX_CONTENT_WIDTH,
  SPACING,
  useAppTheme,
} from '@/shared/theme/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useI18n } from '@/shared/i18n/i18n';
import type {
  AccountabilityIntensity,
  AccountabilityPersonality,
} from '../model/accountabilityTypes';
import { computeAccountabilityPatterns } from '../model/accountabilityInsights';
import { useAccountabilityStore } from '../store/useAccountabilityStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountabilitySettings'>;

/**
 * Ajustes → Seguimiento (plan §8.2.3): interruptor global opt-in, intensidad
 * por defecto, límite diario y pausa. La activación es independiente del
 * permiso técnico de notificaciones (ADR-0008 §3); el reconciliador cancela
 * la agenda si el perfil está apagado.
 */
export const AccountabilitySettingsScreen = (_props: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const profile = useAccountabilityStore((state) => state.profile);
  const commitments = useAccountabilityStore((state) => state.commitments);
  const cycles = useAccountabilityStore((state) => state.cycles);
  const facts = useAccountabilityStore((state) => state.facts);
  const updateProfile = useAccountabilityStore((state) => state.updateProfile);

  const activeCount = commitments.filter((item) => item.enabled).length;
  const patterns = useMemo(() => computeAccountabilityPatterns(cycles, facts), [cycles, facts]);

  const intensityOptions: AccountabilityIntensity[] = ['soft', 'firm', 'demanding'];
  const personalityOptions: AccountabilityPersonality[] = [
    'coach',
    'direct',
    'partner',
    'mentor',
    'minimal',
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.rowTitle}>{t('accountability.settings.enabledTitle')}</Text>
            <Text style={styles.rowBody}>{t('accountability.settings.enabledBody')}</Text>
          </View>
          <Switch
            value={profile.enabled}
            onValueChange={(value) => void updateProfile({ enabled: value })}
            accessibilityLabel={t('accountability.settings.enabledTitle')}
          />
        </View>
        <Text style={styles.hint}>{t('accountability.settings.enabledHint')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>{t('accountability.settings.personalityTitle')}</Text>
        <Text style={styles.rowBody}>{t('accountability.settings.personalityBody')}</Text>
        <View style={styles.wrappedOptionsRow}>
          {personalityOptions.map((value) => {
            const selected = profile.personality === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.personalityOption, selected && styles.optionSelected]}
                onPress={() => void updateProfile({ personality: value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {t(`accountability.personality.${value}` as never)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>{t('accountability.settings.intensityTitle')}</Text>
        <Text style={styles.rowBody}>{t('accountability.settings.intensityBody')}</Text>
        <View style={styles.optionsRow}>
          {intensityOptions.map((value) => {
            const selected = profile.defaultIntensity === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => void updateProfile({ defaultIntensity: value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={
                    value === 'soft'
                      ? 'leaf-outline'
                      : value === 'firm'
                        ? 'flag-outline'
                        : 'flame-outline'
                  }
                  size={17}
                  color={selected ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {t(`accountability.intensity.${value}` as never)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.rowTitle}>{t('accountability.settings.weeklyDigestTitle')}</Text>
            <Text style={styles.rowBody}>{t('accountability.settings.weeklyDigestBody')}</Text>
          </View>
          <Switch
            value={profile.weeklyDigestEnabled}
            onValueChange={(value) => void updateProfile({ weeklyDigestEnabled: value })}
            accessibilityLabel={t('accountability.settings.weeklyDigestTitle')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>{t('accountability.settings.patternsTitle')}</Text>
        {patterns.preferredCompletionHour === null && patterns.mostRescheduledDay === null ? (
          <Text style={styles.rowBody}>{t('accountability.settings.patternsNoData')}</Text>
        ) : (
          <>
            {patterns.preferredCompletionHour !== null ? (
              <Text style={styles.rowBody}>
                {t('accountability.settings.completionHour', {
                  hour: `${String(patterns.preferredCompletionHour).padStart(2, '0')}:00`,
                })}
              </Text>
            ) : null}
            {patterns.mostRescheduledDay ? (
              <Text style={styles.rowBody}>
                {t('accountability.settings.rescheduleDay', {
                  day: t(`accountability.day.${patterns.mostRescheduledDay}` as never),
                })}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.rowTitle}>{t('accountability.settings.escalationTitle')}</Text>
            <Text style={styles.rowBody}>{t('accountability.settings.escalationBody')}</Text>
          </View>
          <Switch
            value={profile.allowEscalation}
            onValueChange={(value) => void updateProfile({ allowEscalation: value })}
            accessibilityLabel={t('accountability.settings.escalationTitle')}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.rowTitle}>{t('accountability.settings.limitTitle')}</Text>
        <Text style={styles.rowBody}>{t('accountability.settings.limitBody')}</Text>
        <View style={styles.optionsRow}>
          {[2, 4, 6].map((value) => {
            const selected = profile.maxNotificationsPerDay === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => void updateProfile({ maxNotificationsPerDay: value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {t('accountability.settings.limitOption', { count: value })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
          <Text style={styles.rowBody}>
            {t('accountability.settings.activeCount', { count: activeCount })}
          </Text>
        </View>
        <Text style={styles.hint}>{t('accountability.settings.activeHint')}</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => {
  const { colors, radius, type } = theme;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING,
      gap: SPACING.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    switchCopy: { flex: 1 },
    rowTitle: { ...type.titleSm, color: colors.onSurface },
    rowBody: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
    hint: { ...type.bodySm, color: colors.onSurfaceVariant },
    optionsRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm },
    wrappedOptionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.sm,
    },
    option: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: SPACING.xs,
    },
    optionSelected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
    personalityOption: {
      minHeight: 44,
      minWidth: '30%',
      flexGrow: 1,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.sm,
    },
    optionText: { ...type.labelMd, color: colors.onSurfaceVariant },
    optionTextSelected: { color: colors.onPrimaryContainer },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  });
};
