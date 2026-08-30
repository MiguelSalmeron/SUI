import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@/shared/ui/Ionicons';
import { signOut } from 'firebase/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/shared/navigation/types';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import { signInAnon } from '../services/onboardingAuth';
import { useIntroStore } from '@/features/onboarding/public';

type Props = NativeStackScreenProps<RootStackParamList, 'MergeData'>;

export const MergeDataScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const resolveCloudMerge = useProductivityStore((state) => state.resolveCloudMerge);
  const completeIntro = useIntroStore((state) => state.completeIntro);
  const setPendingCloudMerge = useIntroStore((state) => state.setPendingCloudMerge);
  const [busy, setBusy] = useState<'combine' | 'cloud' | 'cancel' | null>(null);
  const [error, setError] = useState('');

  const resolve = async (strategy: 'combine' | 'cloud') => {
    setBusy(strategy);
    setError('');
    try {
      await resolveCloudMerge(strategy);
      setPendingCloudMerge(false);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch {
      setError(t('merge.failed'));
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    await signOut(auth).catch(() => undefined);
    await signInAnon();
    completeIntro('local', false);
    setPendingCloudMerge(false);
    setBusy(null);
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const confirmCloud = () => {
    Alert.alert(t('merge.cloudConfirmTitle'), t('merge.cloudConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('merge.cloudConfirmAction'),
        style: 'destructive',
        onPress: () => void resolve('cloud'),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SuiDoodle variant="path" size={86} color={theme.colors.primary} />
        <Text style={styles.title}>{t('merge.title')}</Text>
        <Text style={styles.body}>{t('merge.body')}</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => void resolve('combine')}
          disabled={busy !== null}
        >
          {busy === 'combine' ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Ionicons name="git-merge-outline" size={21} color={theme.colors.onPrimary} />
          )}
          <View style={styles.buttonCopy}>
            <Text style={styles.primaryText}>{t('merge.combine')}</Text>
            <Text style={styles.primaryHint}>{t('merge.combineHint')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={confirmCloud} disabled={busy !== null}>
          {busy === 'cloud' ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name="cloud-download-outline" size={21} color={theme.colors.primary} />
          )}
          <View style={styles.buttonCopy}>
            <Text style={styles.secondaryText}>{t('merge.cloud')}</Text>
            <Text style={styles.secondaryHint}>{t('merge.cloudHint')}</Text>
          </View>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity onPress={() => void cancel()} disabled={busy !== null}>
          <Text style={styles.cancel}>{t('merge.cancel')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, padding: SPACING.xl, justifyContent: 'center', alignItems: 'center' },
    title: {
      ...type.headlineSm,
      color: colors.onSurface,
      textAlign: 'center',
      marginTop: SPACING.lg,
    },
    body: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.xs,
      marginBottom: SPACING.xl,
    },
    primary: {
      width: '100%',
      minHeight: 72,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
    },
    secondary: {
      width: '100%',
      minHeight: 72,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
      marginTop: SPACING.md,
    },
    buttonCopy: { flex: 1 },
    primaryText: { ...type.titleMd, color: colors.onPrimary },
    primaryHint: { ...type.bodySm, color: colors.onPrimary, opacity: 0.76 },
    secondaryText: { ...type.titleMd, color: colors.onSurface },
    secondaryHint: { ...type.bodySm, color: colors.onSurfaceVariant },
    error: { ...type.bodySm, color: colors.error, textAlign: 'center', marginTop: SPACING.md },
    cancel: { ...type.labelLg, color: colors.primary, padding: SPACING.lg },
  });
