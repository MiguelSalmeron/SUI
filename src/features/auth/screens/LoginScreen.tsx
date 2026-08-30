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
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { recordTelemetry } from '@/shared/observability/telemetry';
import { auth } from '@/shared/infrastructure/firebase/firebase';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (linked: boolean, provider: 'password' | 'google' | 'apple') => {
    const localState = useHomeStore.getState();
    const hasLocalData = localState.goals.length > 0 || localState.habits.length > 0;
    const current = auth.currentUser;
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
    void useHomeStore.getState().reloadState();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const mapError = (code?: string) => {
    if (code === 'auth/invalid-credential') return t('auth.invalidCredential');
    if (code === 'auth/network-request-failed') return t('auth.networkError');
    if (code === 'auth/too-many-requests') return t('auth.tooManyRequests');
    return t('auth.genericError');
  };

  const submitEmail = async () => {
    setError('');
    if (!email.includes('@')) return setError(t('auth.invalidEmail'));
    if (password.length < 8) return setError(t('auth.shortPassword'));
    setBusy(true);
    const result = await signInEmailAccount(email, password);
    setBusy(false);
    recordTelemetry('auth.completed', {
      provider: 'password',
      flow: 'login',
      result: result.ok ? 'success' : 'error',
    });
    if (!result.ok) return setError(mapError(result.error));
    finish(false, 'password');
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
    if (!result.ok) return setError(t('auth.genericError'));
    finish(result.linked, 'google');
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
    if (!result.ok) return setError(t('auth.genericError'));
    finish(result.linked, 'apple');
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
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="name@example.com"
        placeholderTextColor={theme.colors.onSurfaceVariant}
      />
      <Text style={styles.label}>{t('auth.password')}</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="••••••••"
        placeholderTextColor={theme.colors.onSurfaceVariant}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <TouchableOpacity style={styles.primary} onPress={() => void submitEmail()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={styles.primaryText}>{t('auth.signIn')}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>{t('auth.forgot')}</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <GoogleSignInButton
        label={t('auth.google')}
        onPress={() => void submitGoogle()}
        busy={googleBusy}
      />
      {appleAvailable ? (
        <AppleSignInButton
          label={t('auth.apple')}
          onPress={() => void submitApple()}
          busy={appleBusy}
        />
      ) : null}
      <TouchableOpacity onPress={() => navigation.replace('Register')}>
        <Text style={styles.link}>{t('auth.needAccount')}</Text>
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
    error: { ...type.bodySm, color: colors.error },
    primary: {
      minHeight: 52,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { ...type.titleMd, color: colors.onPrimary },
    link: {
      ...type.labelLg,
      color: colors.primary,
      textAlign: 'center',
      paddingVertical: SPACING.xs,
    },
    divider: { height: 1, backgroundColor: colors.outlineVariant, marginVertical: SPACING.xs },
  });
