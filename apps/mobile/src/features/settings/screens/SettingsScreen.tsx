import React, { useContext, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { deleteUser, sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext, deleteRegisteredAccount } from '@/features/auth/public';
import { clearGoogleEventsCache } from '@/features/calendar/public';
import { useIntroStore } from '@/features/onboarding/public';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useProductivityStore } from '@/shared/domain/productivity/public';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useI18n } from '@/shared/i18n/i18n';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SPACING,
  type AppTheme,
  type ThemeMode,
  useAppTheme,
  useThemeController,
} from '@/shared/theme/theme';
import {
  useSettingsStore,
  type FontSize,
  type LanguagePreference,
} from '@/shared/preferences/useSettingsStore';
import { cancelNightlyReport, scheduleNightlyReport } from '../services/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type IconName = keyof typeof Ionicons.glyphMap;

type RowProps = {
  icon: IconName;
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
};

const SettingsRow = ({
  icon,
  label,
  description,
  value,
  onPress,
  right,
  destructive,
}: RowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.68 : 1}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={destructive ? theme.colors.error : theme.colors.primary}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowLabel, destructive && { color: theme.colors.error }]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : right}
      {onPress && !right ? (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
      ) : null}
    </TouchableOpacity>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
};

export const SettingsScreen = ({ navigation }: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const { user } = useContext(AuthContext);
  const { mode, setMode } = useThemeController();
  const settings = useSettingsStore();
  const accountMode = useIntroStore((state) => state.accountMode);
  const syncEnabled = useIntroStore((state) => state.syncEnabled);
  const setSyncEnabled = useIntroStore((state) => state.setSyncEnabled);
  const pendingCloudMerge = useIntroStore((state) => state.pendingCloudMerge);
  const setPendingCloudMerge = useIntroStore((state) => state.setPendingCloudMerge);
  const resetIntro = useIntroStore((state) => state.resetIntro);
  const home = useProductivityStore();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const passwordAccount = Boolean(
    user?.providerData.some((item) => item.providerId === 'password'),
  );
  const cloudActive = Boolean(
    accountMode === 'registered' &&
    syncEnabled &&
    user &&
    !user.isAnonymous &&
    (!passwordAccount || user.emailVerified),
  );

  const cycleTheme = () => {
    const values: ThemeMode[] = ['system', 'light', 'dark'];
    void setMode(values[(values.indexOf(mode) + 1) % values.length]);
  };
  const cycleFont = () => {
    const values: FontSize[] = ['small', 'medium', 'large'];
    settings.setFontSize(values[(values.indexOf(settings.fontSize) + 1) % values.length]);
  };
  const cycleLanguage = () => {
    const values: LanguagePreference[] = ['system', 'es', 'en'];
    settings.setLanguage(values[(values.indexOf(settings.language) + 1) % values.length]);
  };

  const syncLabel =
    home.syncStatus === 'syncing'
      ? t('settings.syncing')
      : home.syncStatus === 'pending' || home.syncStatus === 'offline'
        ? t('settings.syncPending')
        : home.syncStatus === 'error'
          ? t('settings.syncError')
          : cloudActive
            ? t('settings.cloudData')
            : t('settings.localData');
  const syncDescription = cloudActive
    ? t('settings.cloudDataDescription')
    : t('settings.localDataDescription');
  const themeLabel =
    mode === 'system' ? t('common.system') : mode === 'dark' ? t('common.dark') : t('common.light');
  const fontLabel =
    settings.fontSize === 'small'
      ? t('common.small')
      : settings.fontSize === 'large'
        ? t('common.large')
        : t('common.medium');
  const languageLabel =
    settings.language === 'system'
      ? t('common.system')
      : settings.language === 'es'
        ? t('common.spanish')
        : t('common.english');

  const exportData = async () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        schemaVersion: 7,
        goals: home.goals,
        habits: home.habits,
        weeklyHistory: home.weeklyHistory,
      },
      null,
      2,
    );
    await Share.share({ title: 'Sui data export', message: payload });
  };

  const performLogout = async () => {
    setLogoutError('');
    setLogoutBusy(true);
    try {
      await signOut(auth);
      await clearGoogleEventsCache();
      await home.clearState();
      resetIntro();
      setLogoutVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    } catch {
      setLogoutBusy(false);
      setLogoutError(t('settings.logoutError'));
    }
  };

  const confirmLogout = () => {
    setLogoutError('');
    setLogoutVisible(true);
  };

  const performDelete = async () => {
    const current = auth.currentUser;
    if (current && !current.isAnonymous) {
      await deleteRegisteredAccount();
    } else if (current) {
      await deleteUser(current);
    }
    await clearGoogleEventsCache();
    await home.clearState();
    resetIntro();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const confirmDelete = () => {
    Alert.alert(t('settings.delete'), t('settings.deleteConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteAction'),
        style: 'destructive',
        onPress: () =>
          void performDelete().catch(() =>
            Alert.alert(t('settings.delete'), t('auth.genericError')),
          ),
      },
    ]);
  };

  const refreshVerification = async () => {
    const current = auth.currentUser;
    if (!current) return;
    try {
      await current.reload();
      if (current.emailVerified) {
        if (pendingCloudMerge) {
          setPendingCloudMerge(false);
          navigation.navigate('MergeData');
          return;
        }
        setSyncEnabled(true);
        await home.syncNow();
        Alert.alert(t('settings.verifyEmail'), t('settings.verificationActive'));
        return;
      }
      await sendEmailVerification(current);
      Alert.alert(t('settings.verifyEmail'), t('settings.verificationSent'));
    } catch {
      Alert.alert(t('settings.verifyEmail'), t('auth.genericError'));
    }
  };

  const requestPasswordChange = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert(t('settings.changePassword'), t('settings.passwordResetSent'));
    } catch {
      Alert.alert(t('settings.changePassword'), t('auth.genericError'));
    }
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Section title={t('settings.appearance')}>
          <SettingsRow
            icon="contrast-outline"
            label={t('settings.theme')}
            value={themeLabel}
            onPress={cycleTheme}
          />
          <SettingsRow
            icon="text-outline"
            label={t('settings.textSize')}
            value={fontLabel}
            onPress={cycleFont}
          />
          <SettingsRow
            icon="language-outline"
            label={t('settings.language')}
            description={t('settings.languageDescription')}
            value={languageLabel}
            onPress={cycleLanguage}
          />
        </Section>

        <Section title={t('settings.general')}>
          <SettingsRow
            icon="notifications-outline"
            label={t('settings.notifications')}
            description={t('settings.notificationsDescription')}
            right={
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(enabled) => {
                  settings.setNotificationsEnabled(enabled);
                  void (enabled ? scheduleNightlyReport() : cancelNightlyReport());
                }}
              />
            }
          />
          <SettingsRow
            icon="extension-puzzle-outline"
            label={t('settings.connections')}
            description={t('settings.connectionsDescription')}
            onPress={() => navigation.navigate('Connections')}
          />
        </Section>

        <Section title={t('settings.account')}>
          <SettingsRow
            icon={cloudActive ? 'cloud-done-outline' : 'phone-portrait-outline'}
            label={syncLabel}
            description={syncDescription}
          />
          {accountMode === 'local' ? (
            <SettingsRow
              icon="shield-checkmark-outline"
              label={t('settings.protectData')}
              description={t('settings.protectDataDescription')}
              onPress={() => navigation.navigate('Register')}
            />
          ) : null}
          {user &&
          !user.isAnonymous &&
          !user.emailVerified &&
          user.providerData.some((item) => item.providerId === 'password') ? (
            <SettingsRow
              icon="mail-unread-outline"
              label={t('settings.verifyEmail')}
              description={t('settings.verifyEmailDescription')}
              onPress={() => void refreshVerification()}
            />
          ) : null}
          {passwordAccount ? (
            <SettingsRow
              icon="key-outline"
              label={t('settings.changePassword')}
              description={t('settings.changePasswordDescription')}
              onPress={() => void requestPasswordChange()}
            />
          ) : null}
          {user && !user.isAnonymous ? (
            <SettingsRow
              icon="person-circle-outline"
              label={user.displayName || user.email || 'Sui'}
              description={user.providerData.map((item) => item.providerId).join(' · ')}
            />
          ) : null}
        </Section>

        <Section title={t('settings.privacy')}>
          <SettingsRow
            icon="download-outline"
            label={t('settings.export')}
            description={t('settings.exportDescription')}
            onPress={() => void exportData()}
          />
          {accountMode === 'registered' ? (
            <SettingsRow
              icon="log-out-outline"
              label={t('settings.logout')}
              onPress={confirmLogout}
            />
          ) : null}
          <SettingsRow
            icon="trash-outline"
            label={t('settings.delete')}
            onPress={confirmDelete}
            destructive
          />
        </Section>
      </ScrollView>
      <ConfirmModal
        visible={logoutVisible}
        title={t('settings.logout')}
        message={t('settings.logoutConfirm')}
        confirmLabel={t('settings.logout')}
        cancelLabel={t('settings.cancel')}
        destructive
        busy={logoutBusy}
        error={logoutError}
        onConfirm={() => void performLogout()}
        onCancel={() => {
          setLogoutVisible(false);
          setLogoutError('');
        }}
      />
    </>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING },
    section: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
    sectionTitle: {
      ...type.labelMd,
      color: colors.primary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: SPACING.xs,
    },
    card: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      overflow: 'hidden',
    },
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    rowCopy: { flex: 1 },
    rowLabel: { ...type.titleMd, color: colors.onSurface },
    rowDescription: { ...type.bodySm, color: colors.onSurfaceVariant, marginTop: 1 },
    rowValue: {
      ...type.labelMd,
      color: colors.onSurfaceVariant,
      marginHorizontal: SPACING.sm,
      textTransform: 'capitalize',
    },
  });
