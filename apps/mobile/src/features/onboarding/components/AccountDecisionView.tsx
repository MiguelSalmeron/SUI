import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import { useI18n } from '@/shared/i18n/i18n';
import { MOTION } from '@/shared/ui/motion/motionTokens';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';
import { OnboardingButton, OnboardingEntrance } from './OnboardingMotion';

interface AccountDecisionViewProps {
  onContinueLocal: () => void;
  onOpenRegister: () => void;
  onOpenLogin: () => void;
}

export const AccountDecisionView = ({
  onContinueLocal,
  onOpenRegister,
  onOpenLogin,
}: AccountDecisionViewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const visual = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const toValue = expanded ? 1 : 0;
    if (reduceMotion !== false) {
      height.setValue(expanded ? bodyHeight : 0);
      visual.setValue(toValue);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(height, {
        toValue: expanded ? bodyHeight : 0,
        duration: 250,
        easing: MOTION.easings.decelerate,
        useNativeDriver: false,
      }),
      Animated.timing(visual, {
        toValue,
        duration: 250,
        easing: MOTION.easings.decelerate,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [bodyHeight, expanded, height, reduceMotion, visual]);

  const openLegal = (url: string) => {
    if (url) void Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <OnboardingEntrance>
        <View style={styles.value}>
          <View style={styles.cloudIcon}>
            <Ionicons name="cloud-outline" size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>{t('welcome.accountValueTitle')}</Text>
          <Text style={styles.body}>{t('welcome.accountValueBody')}</Text>
        </View>
      </OnboardingEntrance>
      <OnboardingEntrance delay={90}>
        <View style={styles.actions}>
          <OnboardingButton
            style={styles.primaryButton}
            onPress={onOpenRegister}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>{t('welcome.create')}</Text>
          </OnboardingButton>
          <OnboardingButton
            style={styles.outlineButton}
            onPress={onOpenLogin}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{t('welcome.login')}</Text>
          </OnboardingButton>
        </View>
      </OnboardingEntrance>
      <OnboardingEntrance delay={180}>
        <View style={styles.offlineCard}>
          <OnboardingButton
            style={styles.offlineHeader}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${t('welcome.tryLocalTitle')}. ${t('welcome.tryLocalSubtitle')}`}
            onPress={() => {
              setExpanded(!expanded);
              setAcknowledged(false);
            }}
          >
            <View style={styles.headerCopy}>
              <Text style={styles.actionText}>{t('welcome.tryLocalTitle')}</Text>
              <Text style={styles.smallBody}>{t('welcome.tryLocalSubtitle')}</Text>
            </View>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: visual.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '180deg'],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
            </Animated.View>
          </OnboardingButton>
          <Animated.View
            style={{ height, overflow: 'hidden' }}
            accessibilityElementsHidden={!expanded}
            importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
          >
            <Animated.View
              style={[
                styles.offlineBody,
                { opacity: visual, pointerEvents: expanded ? 'auto' : 'none' },
              ]}
              onLayout={(event) => setBodyHeight(event.nativeEvent.layout.height)}
            >
              <View style={styles.warning}>
                <Ionicons name="warning-outline" size={22} color={theme.colors.flame} />
                <View style={styles.headerCopy}>
                  <Text style={styles.warningTitle}>{t('welcome.localWarningTitle')}</Text>
                  <Text style={styles.smallBody}>{t('welcome.localWarningBody')}</Text>
                </View>
              </View>
              <OnboardingButton
                style={styles.checkbox}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acknowledged }}
                accessibilityLabel={t('welcome.localAcknowledge')}
                onPress={() => setAcknowledged(!acknowledged)}
              >
                <Ionicons
                  name={acknowledged ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={theme.colors.primary}
                />
                <Text style={styles.checkboxText}>{t('welcome.localAcknowledge')}</Text>
              </OnboardingButton>
              <OnboardingButton
                style={[styles.outlineButton, !acknowledged && styles.disabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !acknowledged }}
                disabled={!acknowledged}
                onPress={() => {
                  if (expanded && acknowledged) onContinueLocal();
                }}
              >
                <Text style={styles.actionText}>{t('welcome.localStart')}</Text>
              </OnboardingButton>
            </Animated.View>
          </Animated.View>
        </View>
        <Text style={styles.legal}>{t('welcome.legalPrefix')}</Text>
        <View style={styles.legalLinks}>
          <OnboardingButton
            style={styles.legalLinkButton}
            onPress={() => openLegal(PRODUCT_CONFIG.termsUrl)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>{t('welcome.terms')}</Text>
          </OnboardingButton>
          <Text style={styles.smallBody}>{t('welcome.and')}</Text>
          <OnboardingButton
            style={styles.legalLinkButton}
            onPress={() => openLegal(PRODUCT_CONFIG.privacyUrl)}
            accessibilityRole="link"
          >
            <Text style={styles.legalLink}>{t('welcome.privacy')}</Text>
          </OnboardingButton>
        </View>
      </OnboardingEntrance>
    </View>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    container: { gap: SPACING.md },
    value: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
    cloudIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...type.titleLg, color: colors.onSurface, textAlign: 'center' },
    body: { ...type.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center' },
    actions: { gap: SPACING.sm },
    primaryButton: {
      minHeight: 52,
      padding: SPACING.sm,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { ...type.labelLg, color: colors.onPrimary },
    outlineButton: {
      minHeight: 52,
      padding: SPACING.sm,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: { ...type.labelLg, color: colors.primary },
    offlineCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainer,
      overflow: 'hidden',
    },
    offlineHeader: {
      minHeight: 44,
      padding: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    headerCopy: { flex: 1, gap: SPACING.xs },
    smallBody: { ...type.bodySm, color: colors.onSurfaceVariant },
    offlineBody: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.md,
      gap: SPACING.sm,
    },
    warning: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    warningTitle: { ...type.labelLg, color: colors.onSurfaceVariant },
    checkbox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    checkboxText: { ...type.bodySm, color: colors.onSurface, flex: 1 },
    disabled: { opacity: 0.65 },
    legal: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
    legalLinks: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
    },
    legalLinkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: SPACING.xs },
    legalLink: { ...type.bodySm, color: colors.primary, textDecorationLine: 'underline' },
  });
