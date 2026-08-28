import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/application/navigation/types';
import { AuthScaffold } from '../components/AuthScaffold';
import { requestPasswordReset } from '../services/emailAuth';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { useI18n } from '@/shared/i18n/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!email.includes('@')) return setMessage(t('auth.invalidEmail'));
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    setMessage(result.ok ? t('auth.resetSent') : t('auth.genericError'));
  };

  return (
    <AuthScaffold title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')} onBack={navigation.goBack}>
      <Text style={styles.label}>{t('auth.email')}</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" placeholderTextColor={theme.colors.onSurfaceVariant} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <TouchableOpacity style={styles.primary} onPress={() => void submit()} disabled={busy}>
        {busy ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={styles.primaryText}>{t('auth.reset')}</Text>}
      </TouchableOpacity>
    </AuthScaffold>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) => StyleSheet.create({
  label: { ...type.labelLg, color: colors.onSurface },
  input: { ...type.bodyLg, minHeight: 50, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, borderRadius: radius.md, paddingHorizontal: SPACING.md, color: colors.onSurface },
  message: { ...type.bodySm, color: colors.onSurfaceVariant },
  primary: { minHeight: 52, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.titleMd, color: colors.onPrimary },
});
