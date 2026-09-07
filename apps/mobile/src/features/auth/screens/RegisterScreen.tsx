import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { createOrLinkEmailAccount } from '../services/emailAuth';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AppleSignInButton } from '../components/AppleSignInButton';
import { AuthScaffold } from '../components/AuthScaffold';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';
import { useIntroStore } from '@/features/onboarding/public';
import {
  hasMeaningfulProductivityData,
  migrateLocalGuestToUser,
  useProductivityStore,
} from '@/shared/domain/productivity/public';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { Ionicons } from '@/shared/ui/Ionicons';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export const RegisterScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const registerAccount = useIntroStore((state) => state.registerAccount);
  const setPendingCloudMerge = useIntroStore((state) => state.setPendingCloudMerge);
  const { signInWithGoogle, busy: googleBusy } = useGoogleAuth();
  const { available: appleAvailable, busy: appleBusy, signInWithApple } = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSubmitting = busy || googleBusy || appleBusy;

  const finishSocial = async (linked: boolean, previousAnonymousUid?: string) => {
    setBusy(true);
    try {
      if (previousAnonymousUid) {
        useIntroStore.getState().setPreviousAnonymousUid(previousAnonymousUid);
      }
      const localState = useProductivityStore.getState();
      const hasLocalData = hasMeaningfulProductivityData(localState);
      const current = auth.currentUser;
      if (linked && current?.uid) {
        await migrateLocalGuestToUser(current.uid, previousAnonymousUid);
      }
      if (hasLocalData && !linked) {
        setPendingCloudMerge(false);
        navigation.replace('MergeData');
        return;
      }
      registerAccount(true);
      setPendingCloudMerge(false);
      await useProductivityStore.getState().reloadState();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } finally {
      setBusy(false);
    }
  };

  const mapRegisterError = (code?: string) => {
    if (code === 'auth/email-already-in-use') return t('auth.emailInUse');
    if (code === 'auth/invalid-email') return t('auth.invalidEmail');
    if (code === 'auth/weak-password') return t('auth.shortPassword');
    if (code === 'auth/network-request-failed') return t('auth.networkError');
    if (code === 'auth/too-many-requests') return t('auth.tooManyRequests');
    return t('auth.genericError');
  };

  const submitEmail = async () => {
    setError('');
    setNotice('');
    if (!email.includes('@')) return setError(t('auth.invalidEmail'));
    if (password.length < 8) return setError(t('auth.shortPassword'));
    if (password !== confirmation) return setError(t('auth.passwordMismatch'));
    setBusy(true);
    try {
      const result = await createOrLinkEmailAccount(email, password);
      recordTelemetry('auth.completed', {
        provider: 'password',
        flow: 'register',
        result: result.ok ? 'success' : 'error',
      });
      if (!result.ok) {
        setBusy(false);
        return setError(mapRegisterError(result.error));
      }
      setNotice(t('auth.verify'));
      setPendingCloudMerge(false);
      registerAccount(false);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setBusy(false);
      setError(t('auth.genericError'));
    }
  };

  const submitGoogle = async () => {
    setError('');
    const result = await signInWithGoogle();
    recordTelemetry('auth.completed', {
      provider: 'google',
      flow: 'register',
      result: result.cancelled ? 'cancel' : result.ok ? 'success' : 'error',
    });
    if (result.cancelled) return;
    if (!result.ok) return setError(result.error || t('auth.genericError'));
    await finishSocial(result.linked, result.previousAnonymousUid);
  };

  const submitApple = async () => {
    setError('');
    const result = await signInWithApple();
    recordTelemetry('auth.completed', {
      provider: 'apple',
      flow: 'register',
      result: result.cancelled ? 'cancel' : result.ok ? 'success' : 'error',
    });
    if (result.cancelled) return;
    if (!result.ok) return setError(result.error || t('auth.genericError'));
    await finishSocial(result.linked, result.previousAnonymousUid);
  };

  return (
    <AuthScaffold
      title={t('auth.createTitle')}
      subtitle={t('auth.createSubtitle')}
      onBack={navigation.goBack}
    >
      <Text style={styles.label}>{t('auth.email')}</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={(val) => {
          setEmail(val);
          if (error) setError('');
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isSubmitting}
        placeholder="name@example.com"
        placeholderTextColor={theme.colors.onSurfaceVariant}
      />
      <Text style={styles.label}>{t('auth.password')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError('');
          }}
          secureTextEntry={!showPassword}
          editable={!isSubmitting}
          autoComplete="new-password"
          placeholder="••••••••"
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          disabled={isSubmitting}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          value={confirmation}
          onChangeText={(val) => {
            setConfirmation(val);
            if (error) setError('');
          }}
          secureTextEntry={!showConfirmation}
          editable={!isSubmitting}
          autoComplete="new-password"
          placeholder="••••••••"
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowConfirmation((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={showConfirmation ? t('auth.hidePassword') : t('auth.showPassword')}
          disabled={isSubmitting}
        >
          <Ionicons
            name={showConfirmation ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <TouchableOpacity
        style={[styles.primary, isSubmitting && styles.primaryDisabled]}
        onPress={() => void submitEmail()}
        disabled={isSubmitting}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={styles.primaryText}>{t('auth.create')}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.divider} />
      <GoogleSignInButton
        label={t('auth.google')}
        onPress={() => void submitGoogle()}
        busy={googleBusy}
        disabled={isSubmitting}
      />
      {appleAvailable ? (
        <AppleSignInButton
          label={t('auth.apple')}
          onPress={() => void submitApple()}
          busy={appleBusy}
          disabled={isSubmitting}
        />
      ) : null}
      <TouchableOpacity onPress={() => navigation.replace('Login')} disabled={isSubmitting}>
        <Text style={[styles.link, isSubmitting && styles.linkDisabled]}>
          {t('auth.haveAccount')}
        </Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    label: { ...type.labelLg, color: colors.onSurface, marginBottom: -SPACING.sm },
    input: {
      ...type.bodyLg,
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.md,
      paddingHorizontal: SPACING.md,
      color: colors.onSurface,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radius.md,
      paddingHorizontal: SPACING.md,
    },
    passwordInput: {
      flex: 1,
      ...type.bodyLg,
      color: colors.onSurface,
      paddingVertical: SPACING.sm,
    },
    eyeButton: {
      padding: SPACING.xs,
      justifyContent: 'center',
      alignItems: 'center',
    },
    error: { ...type.bodySm, color: colors.error },
    notice: { ...type.bodySm, color: colors.secondary },
    primary: {
      minHeight: 52,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryDisabled: {
      opacity: 0.65,
    },
    primaryText: { ...type.titleMd, color: colors.onPrimary },
    link: {
      ...type.labelLg,
      color: colors.primary,
      textAlign: 'center',
      paddingVertical: SPACING.xs,
    },
    linkDisabled: {
      opacity: 0.5,
    },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: SPACING.xs },
  });
