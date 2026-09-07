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
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import { signInEmailAccount } from '../services/emailAuth';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export const LoginScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const registerAccount = useIntroStore((state) => state.registerAccount);
  const setPendingCloudMerge = useIntroStore((state) => state.setPendingCloudMerge);
  const { signInWithGoogle, busy: googleBusy } = useGoogleAuth();
  const { available: appleAvailable, busy: appleBusy, signInWithApple } = useAppleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isSubmitting = busy || googleBusy || appleBusy;

  const finish = async (
    linked: boolean,
    provider: 'password' | 'google' | 'apple',
    previousAnonymousUid?: string,
  ) => {
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
      if (provider === 'password' && current && !current.emailVerified) {
        setPendingCloudMerge(hasLocalData && !linked);
        registerAccount(false);
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }
      if (hasLocalData && !linked) {
        setPendingCloudMerge(false);
        navigation.replace('MergeData');
        return;
      }
      setPendingCloudMerge(false);
      registerAccount(true);
      await useProductivityStore.getState().reloadState();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } finally {
      setBusy(false);
    }
  };

  const mapError = (code?: string) => {
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      return t('auth.invalidCredential');
    }
    if (code === 'auth/unauthorized-domain') return t('auth.unauthorizedDomain');
    if (code === 'auth/user-disabled') return t('auth.userDisabled');
    if (code === 'auth/network-request-failed') return t('auth.networkError');
    if (code === 'auth/too-many-requests') return t('auth.tooManyRequests');
    return t('auth.genericError');
  };

  const submitEmail = async () => {
    setError('');
    if (!email.includes('@')) return setError(t('auth.invalidEmail'));
    if (password.length < 8) return setError(t('auth.shortPassword'));
    setBusy(true);
    try {
      const result = await signInEmailAccount(email, password);
      recordTelemetry('auth.completed', {
        provider: 'password',
        flow: 'login',
        result: result.ok ? 'success' : 'error',
      });
      if (!result.ok) {
        setBusy(false);
        return setError(mapError(result.error));
      }
      await finish(false, 'password');
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
      flow: 'login',
      result: result.cancelled ? 'cancel' : result.ok ? 'success' : 'error',
    });
    if (result.cancelled) return;
    if (!result.ok) return setError(result.error || t('auth.genericError'));
    await finish(result.linked, 'google', result.previousAnonymousUid);
  };

  const submitApple = async () => {
    setError('');
    const result = await signInWithApple();
    recordTelemetry('auth.completed', {
      provider: 'apple',
      flow: 'login',
      result: result.cancelled ? 'cancel' : result.ok ? 'success' : 'error',
    });
    if (result.cancelled) return;
    if (!result.ok) return setError(result.error || t('auth.genericError'));
    await finish(result.linked, 'apple', result.previousAnonymousUid);
  };

  return (
    <AuthScaffold
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
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
          autoComplete="current-password"
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
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[styles.primary, isSubmitting && styles.primaryDisabled]}
        onPress={() => void submitEmail()}
        disabled={isSubmitting}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={styles.primaryText}>{t('auth.signIn')}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('ForgotPassword')}
        disabled={isSubmitting}
      >
        <Text style={[styles.link, isSubmitting && styles.linkDisabled]}>{t('auth.forgot')}</Text>
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
      <TouchableOpacity onPress={() => navigation.replace('Register')} disabled={isSubmitting}>
        <Text style={[styles.link, isSubmitting && styles.linkDisabled]}>
          {t('auth.needAccount')}
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
