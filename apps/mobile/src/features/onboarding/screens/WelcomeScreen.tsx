import { useEffect, useMemo } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiMark } from '@/shared/ui/SuiMark';
import { Ionicons } from '@/shared/ui/Ionicons';
import { useIntroStore } from '../store/useIntroStore';
import { AnimatedMosaic } from '../components/AnimatedMosaic';
import { OnboardingPaginator } from '../components/OnboardingPaginator';
import { ValuePulseSlide } from '../components/ValuePulseSlide';
import { IntentionCard } from '../components/IntentionCard';
import { AccountDecisionView } from '../components/AccountDecisionView';
import { useOnboardingFlow } from '../hooks/useOnboardingFlow';
import { useOrganicEntrance } from '../hooks/useOrganicEntrance';
import type { UserIntention } from '@/shared/account/introTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width <= 340;
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const { locale, t } = useI18n();

  const acceptPolicy = useIntroStore((state) => state.acceptPolicy);
  const completeIntro = useIntroStore((state) => state.completeIntro);
  const setUserIntention = useIntroStore((state) => state.setUserIntention);

  const {
    currentStep,
    totalSteps,
    selectedIntention,
    setSelectedIntention,
    nextStep,
    prevStep,
  } = useOnboardingFlow(0);

  const heroEntrance = useOrganicEntrance({ distance: 16 });

  useEffect(() => {
    if (currentStep === 0) return;
    const onBackPress = () => {
      prevStep();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentStep, prevStep]);

  const recordConsent = () => {
    acceptPolicy({
      minimumAgeConfirmed: true,
      policyVersion: PRODUCT_CONFIG.policyVersion,
      acceptedAt: new Date().toISOString(),
      locale,
    });
    setUserIntention(selectedIntention);
  };

  const handleOpenAuth = (route: 'Login' | 'Register') => {
    recordConsent();
    navigation.navigate(route);
  };

  const handleContinueLocal = () => {
    recordConsent();
    completeIntro('local', false);
    navigation.replace('Home');
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, SPACING.xs) }]}>
      {/* Top Bar: Back/Paginator and Login shortcut on step > 0 */}
      {currentStep > 0 && (
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={prevStep}
            accessibilityRole="button"
            accessibilityLabel={t('welcome.back')}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.onSurface} />
          </TouchableOpacity>

          <OnboardingPaginator total={totalSteps} activeIndex={currentStep} />

          <TouchableOpacity
            style={styles.loginShortcut}
            onPress={() => handleOpenAuth('Login')}
            accessibilityRole="button"
          >
            <Text style={styles.loginShortcutText}>{t('welcome.alreadyHaveAccount')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, SPACING.lg) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 0: Welcome Aperture */}
        {currentStep === 0 && (
          <View style={styles.stepContainer}>
            <AnimatedMosaic compact={compact} />

            <View style={[styles.brandBlock, heroEntrance.animatedStyle]}>
              <SuiMark variant="isologo" size={compact ? 62 : 76} accessible />
              <Text style={styles.title}>{t('brand.tagline')}</Text>
              <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextStep}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('welcome.start')}</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.conversationalLink}
                onPress={() => handleOpenAuth('Login')}
                accessibilityRole="button"
                accessibilityLabel={`${t('welcome.alreadyHaveAccountPrompt')} ${t('welcome.loginAction')}`}
                activeOpacity={0.7}
              >
                <Text style={styles.conversationalPrompt}>
                  {t('welcome.alreadyHaveAccountPrompt')}{' '}
                  <Text style={styles.conversationalAction}>{t('welcome.loginAction')}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 1: Narrative Pulse - Goals */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <ValuePulseSlide
              title={t('onboarding.goalsTitle')}
              description={t('onboarding.goalsDesc')}
              doodleVariant="sprout"
              iconName="flag-outline"
              accentColor={theme.colors.primary}
              containerColor={theme.colors.primaryContainer}
            />

            <View style={styles.stepFooter}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextStep}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('welcome.next')}</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 2: Narrative Pulse - Habits */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <ValuePulseSlide
              title={t('onboarding.habitsTitle')}
              description={t('onboarding.habitsDesc')}
              doodleVariant="rhythm"
              iconName="repeat"
              accentColor={theme.colors.flame}
              containerColor={theme.colors.flameContainer}
            />

            <View style={styles.stepFooter}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextStep}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('welcome.next')}</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Intention Calibration */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.intentionHeader}>
              <Text style={styles.stepTitle}>{t('onboarding.intentionTitle')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding.intentionSubtitle')}</Text>
            </View>

            <View style={styles.intentionsList}>
              <IntentionCard
                id="habit"
                title={t('onboarding.intentions.habit')}
                description={t('onboarding.intentions.habitDesc')}
                iconName="repeat"
                selected={selectedIntention === 'habit'}
                onSelect={(id: UserIntention) => setSelectedIntention(id)}
              />
              <IntentionCard
                id="goal"
                title={t('onboarding.intentions.goal')}
                description={t('onboarding.intentions.goalDesc')}
                iconName="flag-outline"
                selected={selectedIntention === 'goal'}
                onSelect={(id: UserIntention) => setSelectedIntention(id)}
              />
              <IntentionCard
                id="agenda"
                title={t('onboarding.intentions.agenda')}
                description={t('onboarding.intentions.agendaDesc')}
                iconName="calendar-outline"
                selected={selectedIntention === 'agenda'}
                onSelect={(id: UserIntention) => setSelectedIntention(id)}
              />
              <IntentionCard
                id="explore"
                title={t('onboarding.intentions.explore')}
                description={t('onboarding.intentions.exploreDesc')}
                iconName="compass-outline"
                selected={selectedIntention === 'explore'}
                onSelect={(id: UserIntention) => setSelectedIntention(id)}
              />
            </View>

            <View style={styles.stepFooter}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={nextStep}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>{t('welcome.next')}</Text>
                <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 4: Privacy & Account Decision */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <AccountDecisionView
              onContinueLocal={handleContinueLocal}
              onOpenRegister={() => handleOpenAuth('Register')}
              onOpenLogin={() => handleOpenAuth('Login')}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme, compact: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      minHeight: 44,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    loginShortcut: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.xs,
    },
    loginShortcutText: {
      ...type.labelMd,
      color: colors.primary,
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: SPACING.md,
      justifyContent: 'center',
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    brandBlock: {
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      marginTop: compact ? 0 : SPACING.xs,
      marginBottom: SPACING.md,
    },
    title: {
      ...type.brandDisplaySm,
      color: colors.onSurface,
      marginTop: SPACING.xs,
      textAlign: 'center',
    },
    subtitle: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: 4,
    },
    heroActions: {
      paddingHorizontal: SPACING.md,
      marginTop: SPACING.md,
    },
    primaryButton: {
      minHeight: 52,
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.lg,
    },
    primaryButtonText: {
      ...type.titleMd,
      color: colors.onPrimary,
    },
    conversationalLink: {
      marginTop: SPACING.md,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.sm,
    },
    conversationalPrompt: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    conversationalAction: {
      ...type.titleSm,
      color: colors.primary,
    },
    intentionHeader: {
      alignItems: 'center',
      marginBottom: SPACING.md,
      paddingHorizontal: SPACING.sm,
    },
    stepTitle: {
      ...type.titleLg,
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    stepSubtitle: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    intentionsList: {
      marginVertical: SPACING.xs,
    },
    stepFooter: {
      paddingHorizontal: SPACING.sm,
      marginTop: SPACING.md,
    },
  });
