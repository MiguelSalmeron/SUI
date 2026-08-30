import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGoogleCalendar } from '@/features/calendar/public';
import type { RootStackParamList } from '@/shared/navigation/types';
import { useI18n } from '@/shared/i18n/i18n';
import {
  SCREEN_CONTENT_BOTTOM_PADDING,
  SPACING,
  type AppTheme,
  useAppTheme,
} from '@/shared/theme/theme';
import { ScreenIntro } from '@/shared/ui/ScreenIntro';

type Props = NativeStackScreenProps<RootStackParamList, 'Connections'>;

export const ConnectionsScreen = (_props: Props) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, formatDate } = useI18n();
  const calendar = useGoogleCalendar();
  const busy =
    calendar.status === 'syncing' ||
    calendar.status === 'connecting' ||
    calendar.syncStatus === 'loading-cache';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenIntro title={t('connections.title')} subtitle={t('connections.subtitle')} />
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name="logo-google" size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t('connections.googleCalendar')}</Text>
          <Text style={styles.meta}>
            {calendar.connected ? t('connections.connected') : t('connections.notConnected')} ·{' '}
            {t('connections.readOnly')}
          </Text>
          {calendar.lastSyncedAt ? (
            <Text style={styles.detail}>
              {formatDate(new Date(calendar.lastSyncedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : null}
          {calendar.error ? <Text style={styles.error}>{calendar.error}</Text> : null}
        </View>
        {busy ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <TouchableOpacity
            style={styles.action}
            onPress={() => void (calendar.connected ? calendar.sync() : calendar.connect())}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>
              {calendar.connected ? t('connections.sync') : t('connections.connect')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {calendar.connected ? (
        <TouchableOpacity style={styles.disconnect} onPress={() => void calendar.disconnect()}>
          <Text style={styles.disconnectText}>{t('connections.disconnect')}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, paddingBottom: SCREEN_CONTENT_BOTTOM_PADDING },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      padding: SPACING.md,
      gap: SPACING.md,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    title: { ...type.titleMd, color: colors.onSurface },
    meta: { ...type.bodySm, color: colors.onSurfaceVariant },
    detail: { ...type.labelXs, color: colors.onSurfaceVariant, marginTop: 2 },
    error: { ...type.bodySm, color: colors.error, marginTop: SPACING.xs },
    action: {
      minHeight: 40,
      paddingHorizontal: SPACING.md,
      borderRadius: radius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: { ...type.labelMd, color: colors.onPrimaryContainer },
    disconnect: { alignSelf: 'center', marginTop: SPACING.lg, padding: SPACING.md },
    disconnectText: { ...type.labelLg, color: colors.error },
  });
