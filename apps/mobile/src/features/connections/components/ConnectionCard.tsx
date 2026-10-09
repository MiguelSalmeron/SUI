import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, type IoniconName } from '@/shared/ui/Ionicons';
import { SuiLoader } from '@/shared/ui/SuiLoader';
import { useI18n } from '@/shared/i18n/i18n';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import type { ConnectionProvider } from '../types';

type Props<TData> = {
  provider: ConnectionProvider<TData>;
  icon: IoniconName;
  /** Línea de estado extra del provider (cola de espejo, por ejemplo). */
  statusDetail?: string | null;
  /** Botón de desconectar, sólo cuando el provider está conectado. */
  onDisconnect?: () => void;
};

/**
 * Tarjeta de un conector. Genérica a propósito: no sabe si el provider es
 * Google Calendar, Google Tasks u otro. Todo lo que la pantalla tenía cableado
 * a un proveedor concreto vive acá detrás de este contrato.
 */
export function ConnectionCard<TData>({
  provider,
  icon,
  statusDetail,
  onDisconnect,
}: Props<TData>) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t, formatDate } = useI18n();

  const needsReauth = provider.status === 'reauthRequired';
  // Familia 4: sólo la acción que la persona acaba de iniciar muestra indicador.
  const connecting = provider.status === 'connecting';
  // Familia 3: sincronizar nunca bloquea ni esconde el control; el estado va en texto.
  const syncing = provider.status === 'syncing';
  const connected = provider.connected && !needsReauth;

  const actionLabel = needsReauth
    ? t('connections.reconnect')
    : connected
      ? t('connections.sync')
      : t('connections.connect');

  const handleAction = () => {
    if (connected) void provider.sync();
    else void provider.connect();
  };

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t(provider.labelKey)}</Text>
          <Text style={styles.meta}>
            {connected ? t('connections.connected') : t('connections.notConnected')}
          </Text>
          {syncing ? <Text style={styles.detail}>{t('connections.syncing')}</Text> : null}
          {connected && statusDetail ? <Text style={styles.detail}>{statusDetail}</Text> : null}
          {provider.lastSyncedAt ? (
            <Text style={styles.detail}>
              {formatDate(new Date(provider.lastSyncedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : null}
          {needsReauth ? <Text style={styles.error}>{t('connections.reauthHint')}</Text> : null}
          {provider.platformHint ? (
            <Text style={styles.detail}>{provider.platformHint}</Text>
          ) : null}
          {provider.error && !needsReauth ? (
            <Text style={styles.error}>{provider.error}</Text>
          ) : null}
        </View>
        {connecting ? (
          <SuiLoader color={theme.colors.onPrimaryContainer} />
        ) : (
          <TouchableOpacity
            style={[styles.action, syncing && styles.actionDisabled]}
            onPress={handleAction}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ busy: syncing, disabled: syncing }}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      {provider.connected && onDisconnect ? (
        <TouchableOpacity style={styles.disconnect} onPress={onDisconnect}>
          <Text style={styles.disconnectText}>{t('connections.disconnect')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors, radius, type }: AppTheme) =>
  StyleSheet.create({
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
    disconnect: { alignSelf: 'center', marginTop: SPACING.md, padding: SPACING.md },
    disconnectText: { ...type.labelLg, color: colors.error },
  });
