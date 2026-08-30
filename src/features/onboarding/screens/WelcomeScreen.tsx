import { useMemo, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SUI_BRAND } from '@/shared/theme/brand';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { SuiMark } from '@/shared/ui/SuiMark';
import { useIntroStore } from '../store/useIntroStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

const Mosaic = ({ compact }: { compact: boolean }) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const { colors } = theme;

  return (
    <View
      style={styles.mosaic}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.mosaicColumn}>
        <View style={[styles.tile, styles.tileTall, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="sprout" size={58} color={colors.primary} />
          <View style={styles.miniLines}>
            <View style={[styles.miniLine, { backgroundColor: colors.primary }]} />
            <View style={[styles.miniLineShort, { backgroundColor: colors.primary }]} />
          </View>
        </View>
        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.flameContainer }]}>
          <Ionicons name="flame" size={29} color={colors.flame} />
          <View style={styles.rhythmDots}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={[styles.rhythmDot, { backgroundColor: colors.flame }]} />
            ))}
          </View>
        </View>
      </View>
      <View style={[styles.mosaicColumn, styles.middleColumn]}>
        <View
          style={[styles.tile, styles.tileShort, { backgroundColor: colors.secondaryContainer }]}
        >
          <SuiDoodle variant="path" size={52} color={colors.secondary} />
        </View>
        <View
          style={[styles.tile, styles.tileTall, { backgroundColor: colors.surfaceContainerHigh }]}
        >
          <Ionicons name="calendar-outline" size={30} color={colors.primary} />
          <View style={styles.calendarGrid}>
            {Array.from({ length: 12 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDot,
                  { backgroundColor: index === 7 ? colors.flame : colors.outlineVariant },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.mosaicColumn}>
        <View style={[styles.tile, styles.tileTall, { backgroundColor: SUI_BRAND.navy }]}>
          <Ionicons name="flag-outline" size={30} color={SUI_BRAND.blue} />
          <View style={[styles.progressRing, { borderColor: SUI_BRAND.blue }]} />
        </View>
        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="rhythm" size={48} color={colors.primary} />
        </View>
      </View>
      <View style={[styles.mosaicFade, { backgroundColor: colors.background }]} />
    </View>
  );
};

export const WelcomeScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width <= 340;
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const { locale, t } = useI18n();
  const acceptPolicy = useIntroStore((state) => state.acceptPolicy);
  const completeIntro = useIntroStore((state) => state.completeIntro);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageError, setAgeError] = useState(false);

  const validateAge = () => {
    if (ageConfirmed) return true;
    setAgeError(true);
    return false;
  };

  const recordConsent = () => {
    acceptPolicy({
      minimumAgeConfirmed: true,
      policyVersion: PRODUCT_CONFIG.policyVersion,
      acceptedAt: new Date().toISOString(),
      locale,
    });
  };

  const openAuth = (route: 'Login' | 'Register') => {
    if (!validateAge()) return;
    recordConsent();
    navigation.navigate(route);
  };

  const continueLocal = () => {
    if (!validateAge()) return;
    recordConsent();
    completeIntro('local', false);
    navigation.replace('Home');
  };

  const openLegal = (url: string) => {
    if (url) void Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, SPACING.sm) }]}
      showsVerticalScrollIndicator={false}
    >
      <Mosaic compact={compact} />
      <View style={styles.brandBlock}>
        <SuiMark variant="isologo" size={compact ? 62 : 76} accessible />
        <Text style={styles.title}>{t('brand.tagline')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </View>

      <TouchableOpacity
        style={styles.ageRow}
        onPress={() => {
          setAgeConfirmed((current) => !current);
          setAgeError(false);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ageConfirmed }}
      >
        <View style={[styles.checkbox, ageConfirmed && styles.checkboxSelected]}>
          {ageConfirmed ? <Ionicons name="checkmark" size={16} color={colors.onPrimary} /> : null}
        </View>
        <Text style={styles.ageText}>{t('welcome.age')}</Text>
      </TouchableOpacity>
      {ageError ? <Text style={styles.error}>{t('welcome.ageRequired')}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={() => openAuth('Register')}>
          <Text style={styles.primaryButtonText}>{t('welcome.create')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => openAuth('Login')}>
          <Text style={styles.secondaryButtonText}>{t('welcome.login')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.localButton} onPress={continueLocal}>
          <Text style={styles.localButtonText}>{t('welcome.local')}</Text>
          <Text style={styles.localHint}>{t('welcome.localHint')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.legal}>
        {t('welcome.legalPrefix')}{' '}
        <Text style={styles.legalLink} onPress={() => openLegal(PRODUCT_CONFIG.termsUrl)}>
          {t('welcome.terms')}
        </Text>{' '}
        {t('welcome.and')}{' '}
        <Text style={styles.legalLink} onPress={() => openLegal(PRODUCT_CONFIG.privacyUrl)}>
          {t('welcome.privacy')}
        </Text>
      </Text>
    </ScrollView>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme, compact: boolean) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, paddingBottom: SPACING.lg },
    mosaic: {
      height: compact ? 240 : 300,
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      overflow: 'hidden',
    },
    mosaicColumn: { flex: 1, gap: SPACING.sm },
    middleColumn: { marginTop: compact ? 20 : 30 },
    tile: {
      borderRadius: radius.xl,
      padding: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    tileTall: { flex: 1.35 },
    tileShort: { flex: 0.8 },
    miniLines: { alignSelf: 'stretch', gap: 6, marginTop: SPACING.sm },
    miniLine: { height: 5, borderRadius: 3, opacity: 0.34 },
    miniLineShort: { width: '62%', height: 5, borderRadius: 3, opacity: 0.24 },
    rhythmDots: { flexDirection: 'row', gap: 5, marginTop: SPACING.sm },
    rhythmDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', width: 54, gap: 5, marginTop: 14 },
    calendarDot: { width: 9, height: 9, borderRadius: 3 },
    progressRing: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 6,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.md,
    },
    mosaicFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28, opacity: 0.72 },
    brandBlock: {
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      marginTop: compact ? 0 : SPACING.xs,
    },
    title: {
      ...type.brandDisplaySm,
      color: colors.onSurface,
      marginTop: SPACING.xs,
      textAlign: 'center',
    },
    subtitle: { ...type.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', marginTop: 2 },
    ageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      marginTop: SPACING.md,
      minHeight: 44,
      paddingHorizontal: SPACING.sm,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    ageText: { ...type.bodyMd, color: colors.onSurface },
    error: { ...type.bodySm, color: colors.error, textAlign: 'center', marginTop: -4 },
    actions: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, marginTop: SPACING.sm },
    primaryButton: {
      minHeight: 52,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { ...type.titleMd, color: colors.onPrimary },
    secondaryButton: {
      minHeight: 52,
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: { ...type.titleMd, color: colors.onSurface },
    localButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    localButtonText: { ...type.labelLg, color: colors.primary },
    localHint: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    legal: {
      ...type.labelXs,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      paddingHorizontal: SPACING.xl,
      marginTop: SPACING.sm,
    },
    legalLink: { color: colors.primary, textDecorationLine: 'underline' },
  });
