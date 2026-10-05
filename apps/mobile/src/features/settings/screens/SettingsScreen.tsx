import React, { useContext, useMemo, useState } from 'react';
import {
  Linking,
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
import { SelectionModal } from '@/shared/ui/SelectionModal';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AuthContext,
  deleteAnonymousUser,
  deleteRegisteredAccount,
  requestPasswordResetForCurrentUser,
  resendVerificationEmail,
  signOutCurrentUser,
} from '@/features/auth/public';
import { clearGoogleEventsCache } from '@/features/calendar/public';
import { useIntroStore } from '@/features/onboarding/public';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import {
  clearLocalProductivity,
  useProductivityStore,
  type ProductivityState,
} from '@/shared/domain/productivity/public';
import { PRODUCT_CONFIG } from '@/shared/config/product';
import {
  cancelAllAccountabilityNotifications,
  clearAccountability,
  exportAccountability,
  useAccountabilityStore,
} from '@/features/accountability/public';
import {
  cancelAllEngagementNotifications,
  clearEngagement,
  EngagementSettingsSection,
  useEngagementStore,
} from '@/features/engagement/public';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useI18n } from '@/shared/i18n/i18n';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SCREEN_MAX_CONTENT_WIDTH,
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
import {
  disableNightlyReport,
  scheduleNightlyReport,
  type NotificationEnableResult,
} from '../services/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type IconName = keyof typeof Ionicons.glyphMap;

export type AccountSyncState =
  | 'cloud'
  | 'pending'
  | 'local'
  | 'localRegistered'
  | 'offline'
  | 'error'
  | 'syncing';

/**
 * Estado de cuenta visible en Ajustes.
 *
 * Sin red (`offline`) se avisa que todo sigue guardado acá, incluso sin
 * cuenta. Sin respaldo (`cloudActive` falso) nunca se muestra error de nube:
 * con cuenta registrada se avisa que el respaldo sigue sin activarse, sin
 * cuenta es vida local. Nunca expone términos internos.
 */
export const resolveAccountSyncState = (
  syncStatus: ProductivityState['syncStatus'],
  cloudActive: boolean,
  accountMode: 'local' | 'registered',
): AccountSyncState => {
  if (syncStatus === 'offline') return 'offline';
  if (!cloudActive) return accountMode === 'registered' ? 'localRegistered' : 'local';
  if (syncStatus === 'error') return 'error';
  if (syncStatus === 'pending') return 'pending';
  if (syncStatus === 'syncing') return 'syncing';
  return 'cloud';
};

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
  // Al salir o borrar la cuenta se va con `resetIntroAndSeeds`: la siembra es
  // parte del estado de primer ingreso, así que el próximo ingreso arranca
  // limpio y vuelve a elegir intención.
  const resetIntro = useIntroStore((state) => state.resetIntroAndSeeds);
  const home = useProductivityStore();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [selection, setSelection] = useState<'theme' | 'font' | 'language' | null>(null);
  const [notificationConfirmVisible, setNotificationConfirmVisible] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationNotice, setNotificationNotice] = useState('');
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

  const notificationMessage = (result: NotificationEnableResult) =>
    result === 'scheduled'
      ? t('settings.notificationsEnabled')
      : result === 'blocked'
        ? t('settings.notificationsBlocked')
        : result === 'denied'
          ? t('settings.notificationsDenied')
          : t('settings.notificationsError');

  const enableNotifications = async () => {
    setNotificationBusy(true);
    const result = await scheduleNightlyReport();
    setNotificationBusy(false);
    setNotificationConfirmVisible(false);
    setNotificationNotice(notificationMessage(result));
    if (result === 'blocked') {
      Alert.alert(t('settings.notifications'), t('settings.notificationsBlocked'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.openSettings'), onPress: () => void Linking.openSettings() },
      ]);
    }
  };

  const accountState = resolveAccountSyncState(home.syncStatus, cloudActive, accountMode);
  const syncLabel =
    accountState === 'cloud'
      ? t('settings.accountCloud')
      : accountState === 'pending'
        ? t('settings.accountPending')
        : accountState === 'offline'
          ? t('settings.accountOffline')
          : accountState === 'error'
            ? t('settings.accountError')
            : accountState === 'syncing'
              ? t('settings.accountSyncing')
              : accountState === 'localRegistered'
                ? t('settings.accountLocalRegistered')
                : t('settings.accountLocal');
  const syncDescription =
    accountState === 'cloud'
      ? t('settings.accountCloudDescription')
      : accountState === 'pending'
        ? t('settings.accountPendingDescription')
        : accountState === 'syncing'
          ? t('settings.accountSyncingDescription')
          : accountState === 'offline'
            ? t('settings.accountOfflineDescription')
            : accountState === 'error'
              ? t('settings.accountErrorDescription')
              : accountState === 'localRegistered'
                ? t('settings.accountLocalRegisteredDescription')
                : t('settings.accountLocalDescription');
  const syncIcon: IconName =
    accountState === 'cloud'
      ? 'cloud-done-outline'
      : accountState === 'pending' || accountState === 'syncing'
        ? 'cloud-upload-outline'
        : accountState === 'offline' || accountState === 'error'
          ? 'cloud-offline-outline'
          : 'phone-portrait-outline';
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
    const accountability = await exportAccountability(user?.uid ?? null);
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        schemaVersion: 8,
        goals: home.goals,
        habits: home.habits,
        weeklyHistory: home.weeklyHistory,
        accountability,
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
      await signOutCurrentUser();
      await cancelAllAccountabilityNotifications();
      await useAccountabilityStore.getState().handleAuthUserChanged(null);
      await cancelAllEngagementNotifications();
      await useEngagementStore.getState().handleAuthUserChanged(null);
      await clearGoogleEventsCache();
      await home.clearState({ preserveStorage: true });
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
    const currentUid = current?.uid;
    if (current && !current.isAnonymous) {
      await deleteRegisteredAccount();
    } else if (current) {
      await deleteAnonymousUser();
    }
    await clearGoogleEventsCache();
    await cancelAllAccountabilityNotifications();
    await clearAccountability(currentUid ?? null);
    await clearEngagement(currentUid ?? null);
    if (currentUid) {
      await clearLocalProductivity(currentUid);
    }
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
      await resendVerificationEmail();
      Alert.alert(t('settings.verifyEmail'), t('settings.verificationSent'));
    } catch {
      Alert.alert(t('settings.verifyEmail'), t('auth.genericError'));
    }
  };

  const requestPasswordChange = async () => {
    if (!user?.email) return;
    try {
      await requestPasswordResetForCurrentUser();
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
            onPress={() => setSelection('theme')}
          />
          <SettingsRow
            icon="text-outline"
            label={t('settings.textSize')}
            value={fontLabel}
            onPress={() => setSelection('font')}
          />
          <SettingsRow
            icon="language-outline"
            label={t('settings.language')}
            description={t('settings.languageDescription')}
            value={languageLabel}
            onPress={() => setSelection('language')}
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
                  setNotificationNotice('');
                  if (enabled) setNotificationConfirmVisible(true);
                  else void disableNightlyReport();
                }}
                accessibilityLabel={t('settings.notifications')}
              />
            }
          />
          {notificationNotice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notificationNotice}
            </Text>
          ) : null}
          <SettingsRow
            icon="extension-puzzle-outline"
            label={t('settings.connections')}
            description={t('settings.connectionsDescription')}
            onPress={() => navigation.navigate('Connections')}
          />
          {PRODUCT_CONFIG.accountabilityEnabled ? (
            <SettingsRow
              icon="flag-outline"
              label={t('accountability.settings.title')}
              description={t('accountability.settings.enabledBody')}
              onPress={() => navigation.navigate('AccountabilitySettings')}
            />
          ) : null}
          <SettingsRow
            icon="calendar-outline"
            label={t('settings.mirrorGoals')}
            description={t('settings.mirrorGoalsDescription')}
            right={
              <Switch
                value={settings.mirrorGoalsEnabled}
                onValueChange={settings.setMirrorGoalsEnabled}
                accessibilityLabel={t('settings.mirrorGoals')}
              />
            }
          />
          <SettingsRow
            icon="repeat-outline"
            label={t('settings.mirrorHabits')}
            description={t('settings.mirrorHabitsDescription')}
            right={
              <Switch
                value={settings.mirrorHabitsEnabled}
                onValueChange={settings.setMirrorHabitsEnabled}
                accessibilityLabel={t('settings.mirrorHabits')}
              />
            }
          />
        </Section>

        {PRODUCT_CONFIG.engagementEnabled ? (
          <Section title={t('engagement.settings.title')}>
            <EngagementSettingsSection />
          </Section>
        ) : null}

        <Section title={t('settings.account')}>
          <SettingsRow icon={syncIcon} label={syncLabel} description={syncDescription} />
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
      <ConfirmModal
        visible={notificationConfirmVisible}
        title={t('settings.notificationsConfirmTitle')}
        message={t('settings.notificationsConfirmBody')}
        confirmLabel={t('settings.notificationsConfirmAction')}
        cancelLabel={t('common.cancel')}
        busy={notificationBusy}
        onConfirm={() => void enableNotifications()}
        onCancel={() => setNotificationConfirmVisible(false)}
      />
      <SelectionModal<ThemeMode>
        visible={selection === 'theme'}
        title={t('settings.theme')}
        value={mode}
        closeLabel={t('common.close')}
        options={[
          { value: 'system', label: t('common.system') },
          { value: 'light', label: t('common.light') },
          { value: 'dark', label: t('common.dark') },
        ]}
        onSelect={(value) => void setMode(value)}
        onClose={() => setSelection(null)}
      />
      <SelectionModal<FontSize>
        visible={selection === 'font'}
        title={t('settings.textSize')}
        value={settings.fontSize}
        closeLabel={t('common.close')}
        options={[
          { value: 'small', label: t('common.small') },
          { value: 'medium', label: t('common.medium') },
          { value: 'large', label: t('common.large') },
        ]}
        onSelect={settings.setFontSize}
        onClose={() => setSelection(null)}
      />
      <SelectionModal<LanguagePreference>
        visible={selection === 'language'}
        title={t('settings.language')}
        value={settings.language}
        closeLabel={t('common.close')}
        options={[
          { value: 'system', label: t('common.system') },
          { value: 'es', label: t('common.spanish') },
          { value: 'en', label: t('common.english') },
        ]}
        onSelect={settings.setLanguage}
        onClose={() => setSelection(null)}
      />
    </>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING, alignItems: 'center' },
    section: {
      width: '100%',
      maxWidth: SCREEN_MAX_CONTENT_WIDTH,
      paddingHorizontal: SPACING.lg,
      marginTop: SPACING.lg,
    },
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
    notice: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.sm,
    },
  });
