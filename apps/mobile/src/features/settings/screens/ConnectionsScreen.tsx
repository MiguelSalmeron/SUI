import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SuiLoader } from '@/shared/ui/SuiLoader';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getMirrorQueueLength, useGoogleCalendar } from '@/features/calendar/public';
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
  // Familia 4: sólo la acción que el usuario acaba de iniciar muestra indicador.
  const connecting = calendar.status === 'connecting';
  // Familia 3: sincronizar nunca bloquea ni esconde el control; el estado va en texto.
  const syncing = calendar.status === 'syncing';
  const needsReauth = calendar.connectionStatus === 'reauthRequired';
  const [mirrorPending, setMirrorPending] = useState(0);

  useEffect(() => {
    let active = true;
    if (!calendar.connected) {
      setMirrorPending(0);
      return;
    }
    void getMirrorQueueLength()
      .then((count) => {
        if (active) setMirrorPending(count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [calendar.connected, calendar.status]);

  const actionLabel = needsReauth
    ? t('connections.reconnect')
    : calendar.connected
      ? t('connections.sync')
      : t('connections.connect');

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
            {t('connections.mirrorActive')}
          </Text>
          {syncing ? <Text style={styles.detail}>{t('connections.syncing')}</Text> : null}
          {calendar.connected && mirrorPending > 0 ? (
            <Text style={styles.detail}>
              {t('connections.mirrorPending', { count: mirrorPending })}
            </Text>
          ) : null}
          {calendar.lastSyncedAt ? (
            <Text style={styles.detail}>
              {formatDate(new Date(calendar.lastSyncedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : null}
          {needsReauth ? <Text style={styles.error}>{t('connections.reauthHint')}</Text> : null}
          {calendar.platformHint ? (
            <Text style={styles.detail}>{calendar.platformHint}</Text>
          ) : null}
          {calendar.error && !needsReauth ? (
            <Text style={styles.error}>{calendar.error}</Text>
          ) : null}
        </View>
        {connecting ? (
          <SuiLoader color={theme.colors.onPrimaryContainer} />
        ) : (
          <TouchableOpacity
            style={[styles.action, syncing && styles.actionDisabled]}
            onPress={() =>
              void (calendar.connected && !needsReauth ? calendar.sync() : calendar.connect())
            }
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ busy: syncing, disabled: syncing }}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
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
      minHeight: 44,
      paddingHorizontal: SPACING.md,
      borderRadius: radius.full,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionDisabled: { opacity: 0.55 },
    actionText: { ...type.labelMd, color: colors.onPrimaryContainer },
    disconnect: { alignSelf: 'center', marginTop: SPACING.lg, padding: SPACING.md },
    disconnectText: { ...type.labelLg, color: colors.error },
  });
