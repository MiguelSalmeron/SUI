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
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { recordTelemetry } from '@/shared/observability/telemetry';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const finishSocial = (linked: boolean) => {
    const localState = useProductivityStore.getState();
    const hasLocalData = localState.goals.length > 0 || localState.habits.length > 0;
    if (hasLocalData && !linked) {
      setPendingCloudMerge(false);
      navigation.replace('MergeData');
      return;
    }
    registerAccount(true);
    setPendingCloudMerge(false);
    void useProductivityStore.getState().syncNow();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const submitEmail = async () => {
    setError('');
    setNotice('');
    if (!email.includes('@')) return setError(t('auth.invalidEmail'));
    if (password.length < 8) return setError(t('auth.shortPassword'));
    if (password !== confirmation) return setError(t('auth.passwordMismatch'));
    setBusy(true);
    const result = await createOrLinkEmailAccount(email, password);
    setBusy(false);
    recordTelemetry('auth.completed', {
      provider: 'password',
      flow: 'register',
      result: result.ok ? 'success' : 'error',
    });
    if (!result.ok) {
      return setError(
        result.error === 'auth/email-already-in-use'
          ? t('auth.emailInUse')
          : t('auth.genericError'),
      );
    }
    setNotice(t('auth.verify'));
    setPendingCloudMerge(false);
    registerAccount(false);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
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
    if (!result.ok) return setError(t('auth.genericError'));
    finishSocial(result.linked);
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
    if (!result.ok) return setError(t('auth.genericError'));
    finishSocial(result.linked);
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
        autoComplete="new-password"
        placeholder="••••••••"
        placeholderTextColor={theme.colors.onSurfaceVariant}
      />
      <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
      <TextInput
        style={styles.input}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoComplete="new-password"
        placeholder="••••••••"
        placeholderTextColor={theme.colors.onSurfaceVariant}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <TouchableOpacity style={styles.primary} onPress={() => void submitEmail()} disabled={busy}>
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
      />
      {appleAvailable ? (
        <AppleSignInButton
          label={t('auth.apple')}
          onPress={() => void submitApple()}
          busy={appleBusy}
        />
      ) : null}
      <TouchableOpacity onPress={() => navigation.replace('Login')}>
        <Text style={styles.link}>{t('auth.haveAccount')}</Text>
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
    notice: { ...type.bodySm, color: colors.secondary },
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
