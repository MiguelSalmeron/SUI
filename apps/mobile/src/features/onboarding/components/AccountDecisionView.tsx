import { useMemo } from 'react';
import {
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import { useI18n } from '@/shared/i18n/i18n';
import { useOrganicEntrance } from '../hooks/useOrganicEntrance';

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
  const entrance = useOrganicEntrance({ distance: 18 });

  const openLegal = (url: string) => {
    if (url) void Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.privacyBox, entrance.animatedStyle]}>
        <View style={styles.shieldIcon}>
          <Ionicons name="shield-checkmark" size={32} color={theme.colors.primary} />
        </View>
        <Text style={styles.privacyTitle}>{t('onboarding.privacyTitle')}</Text>
        <Text style={styles.privacyBody}>{t('onboarding.privacyBody')}</Text>
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.continueLocalButton}
          onPress={onContinueLocal}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={20} color={theme.colors.onPrimary} />
          <Text style={styles.continueLocalText}>{t('onboarding.accountLater')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={onOpenRegister}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.registerText}>{t('welcome.create')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={onOpenLogin}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <Text style={styles.loginText}>{t('welcome.login')}</Text>
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
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      justifyContent: 'space-between',
      flex: 1,
    },
    privacyBox: {
      alignItems: 'center',
      padding: SPACING.lg,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      marginVertical: SPACING.sm,
    },
    shieldIcon: {
      width: 56,
      height: 56,
      borderRadius: theme.radius.full,
      backgroundColor: theme.colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    privacyTitle: {
      ...theme.type.titleLg,
      color: theme.colors.onSurface,
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    privacyBody: {
      ...theme.type.bodyMd,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    actions: {
      gap: SPACING.sm,
      marginVertical: SPACING.sm,
    },
    continueLocalButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: theme.radius.full,
      gap: SPACING.xs,
    },
    continueLocalText: {
      ...theme.type.labelLg,
      color: theme.colors.onPrimary,
    },
    registerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceContainerHighest,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderRadius: theme.radius.full,
      gap: SPACING.xs,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    registerText: {
      ...theme.type.labelLg,
      color: theme.colors.onSurface,
    },
    loginButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.xs,
    },
    loginText: {
      ...theme.type.labelMd,
      color: theme.colors.primary,
    },
    legal: {
      ...theme.type.bodySm,
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center',
      paddingHorizontal: SPACING.sm,
      marginTop: SPACING.xs,
    },
    legalLink: {
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
  });
