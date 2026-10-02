import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import { useI18n } from '@/shared/i18n/i18n';
import {
  SPACING,
  SCREEN_MAX_CONTENT_WIDTH,
  type AppTheme,
  useAppTheme,
} from '@/shared/theme/theme';
import { SuiMark } from '@/shared/ui/SuiMark';
import { Ionicons } from '@/shared/ui/Ionicons';
import { MOTION } from '@/shared/ui/motion/motionTokens';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { useIntroStore } from '../store/useIntroStore';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { AccountDecisionView } from '../components/AccountDecisionView';
import { IntentionPicker } from '../components/IntentionPicker';
import { OnboardingButton, OnboardingEntrance } from '../components/OnboardingMotion';
import { useOnboardingFlow } from '../hooks/useOnboardingFlow';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export const WelcomeScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { locale, t } = useI18n();
  const acceptPolicy = useIntroStore((state) => state.acceptPolicy);
  const completeIntro = useIntroStore((state) => state.completeIntro);
  const setUserIntention = useIntroStore((state) => state.setUserIntention);
  const seedStarterData = useProductivityStore((state) => state.seedStarterData);
  const { currentStep, totalSteps, selectedIntention, setSelectedIntention, goToStep } =
    useOnboardingFlow();
  const reduceMotion = useReduceMotion();
  const exit = useRef(new Animated.Value(1)).current;
  const transition = useRef<Animated.CompositeAnimation | null>(null);
  const pendingStep = useRef<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const changeStep = useCallback(
    (step: number) => {
      if (pendingStep.current !== null || step === currentStep) return;
      pendingStep.current = step;
      setTransitioning(true);
      if (step === 1) {
        setUserIntention(selectedIntention);
        // La siembra va antes de la decisión de cuenta: la vista previa del
        // picker ya la prometió, y hacerlo acá evita que quien entra por login
        // (que se salta el paso 1) salga con Inicio vacío sin habérselo anunciado.
        seedStarterData(selectedIntention, t);
      }
      const finish = () => {
        goToStep(step);
        exit.setValue(1);
        pendingStep.current = null;
        setTransitioning(false);
        scroll.current?.scrollTo({ y: 0, animated: false });
      };
      if (reduceMotion !== false) {
        finish();
        return;
      }
      transition.current = Animated.timing(exit, {
        toValue: 0,
        duration: MOTION.durations.quick,
        easing: MOTION.easings.accelerate,
        useNativeDriver: true,
      });
      transition.current.start(({ finished }) => {
        if (finished) finish();
      });
    },
    [
      currentStep,
      exit,
      goToStep,
      reduceMotion,
      seedStarterData,
      selectedIntention,
      setUserIntention,
      t,
    ],
  );

  useEffect(() => {
    if (reduceMotion === true && pendingStep.current !== null) {
      transition.current?.stop();
      goToStep(pendingStep.current);
      pendingStep.current = null;
      exit.setValue(1);
      setTransitioning(false);
    }
  }, [exit, goToStep, reduceMotion]);

  useEffect(() => () => transition.current?.stop(), []);
  useEffect(() => {
    recordTelemetry('onboarding.step_view', { step: currentStep });
  }, [currentStep]);
  useEffect(() => {
    if (currentStep === 0) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      changeStep(0);
      return true;
    });
    return () => subscription.remove();
  }, [changeStep, currentStep]);

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
    recordTelemetry('onboarding.account_open', { route });
    // El enlace de login vive en el paso 0 y se salta el picker, así que la
    // siembra no corrió. Sin esto ese usuario vería Inicio vacío pese a haber
    // visto la vista previa prometida.
    seedStarterData(selectedIntention, t);
    navigation.navigate(route);
  };
  const handleContinueLocal = () => {
    recordConsent();
    completeIntro('local', false);
    recordTelemetry('onboarding.local_start');
    recordTelemetry('onboarding.complete', { mode: 'local' });
    navigation.replace('Home');
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, SPACING.xs) }]}>
      <View style={styles.topBar}>
        {currentStep > 0 ? (
          <OnboardingButton
            style={styles.backButton}
            onPress={() => changeStep(0)}
            disabled={transitioning}
            accessibilityRole="button"
            accessibilityLabel={t('welcome.back')}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.onSurface} />
          </OnboardingButton>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text accessibilityLiveRegion="polite" style={styles.stepLabel}>
          {t('welcome.step', { current: currentStep + 1, total: totalSteps })}
        </Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView
        ref={scroll}
        style={styles.scrollContainer}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, SPACING.md) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.stepContainer,
            {
              opacity: exit,
              transform: [
                { translateX: exit.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
              ],
              pointerEvents: transitioning ? 'none' : 'auto',
            },
          ]}
          accessibilityElementsHidden={transitioning}
          importantForAccessibility={transitioning ? 'no-hide-descendants' : 'auto'}
        >
          {currentStep === 0 ? (
            <View key="welcome">
              <OnboardingEntrance>
                <View style={styles.brandBlock}>
                  <SuiMark variant="isologo" size={48} accessible />
                </View>
              </OnboardingEntrance>
              <OnboardingEntrance delay={90}>
                <Text style={styles.title}>{t('brand.tagline')}</Text>
                <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
              </OnboardingEntrance>
              <IntentionPicker
                selected={selectedIntention}
                onSelect={setSelectedIntention}
                onConfirm={() => changeStep(1)}
                busy={transitioning}
                active={focused}
              />
              <OnboardingButton
                style={styles.loginLink}
                onPress={() => handleOpenAuth('Login')}
                accessibilityRole="button"
                accessibilityLabel={`${t('welcome.alreadyHaveAccountPrompt')} ${t('welcome.loginAction')}`}
              >
                <Text style={styles.subtitle}>
                  {t('welcome.alreadyHaveAccountPrompt')}{' '}
                  <Text style={styles.linkText}>{t('welcome.loginAction')}</Text>
                </Text>
              </OnboardingButton>
            </View>
          ) : (
            <AccountDecisionView
              key="account"
              onContinueLocal={handleContinueLocal}
              onOpenRegister={() => handleOpenAuth('Register')}
              onOpenLogin={() => handleOpenAuth('Login')}
            />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'center',
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      paddingHorizontal: SPACING.md,
    },
    backButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    stepLabel: { ...type.labelSm, color: colors.onSurfaceVariant },
    scrollContainer: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.md, justifyContent: 'center' },
    stepContainer: { width: '100%', maxWidth: SCREEN_MAX_CONTENT_WIDTH, alignSelf: 'center' },
    brandBlock: {
      alignItems: 'center',
    },
    title: {
      ...type.brandDisplaySm,
      color: colors.onSurface,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    subtitle: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    loginLink: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.xs,
    },
    linkText: { ...type.labelLg, color: colors.primary },
  });
