import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IDENTITY_COLORS, IDENTITY_EMOJIS } from '@sui/contracts';
import { Avatar } from '@/shared/ui/Avatar';
import { defaultIdentity, useIdentityStore } from '@/shared/identity/useIdentityStore';
import { syncIdentity } from '@/shared/identity/identitySync';
import {
  pickPhoto,
  saveLocalPhoto,
  removeLocalPhoto,
  removePhotoPreview,
} from '@/shared/infrastructure/profile/localPhoto';
import { useI18n } from '@/shared/i18n/i18n';
import { useAppTheme, SPACING } from '@/shared/theme/theme';
import { IDENTITY_PALETTE } from '@/shared/theme/tokens';
export function IdentitySheet({
  visible,
  name,
  onClose,
  owner,
}: {
  visible: boolean;
  name: string;
  onClose: () => void;
  owner?: string;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const store = useIdentityStore();
  const active = !owner || store.owner === owner;
  const identity = active ? store.identity : defaultIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string>();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
        sheet: {
          width: '100%',
          maxWidth: 560,
          maxHeight: '90%',
          alignSelf: 'center',
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
        },
        content: {
          padding: SPACING.lg,
          paddingBottom: Math.max(insets.bottom, SPACING.lg),
          gap: SPACING.md,
        },
        title: { ...theme.type.titleLg, color: theme.colors.onSurface },
        label: { ...theme.type.labelLg, color: theme.colors.onSurface },
        body: { ...theme.type.bodyMd, color: theme.colors.onSurfaceVariant },
        error: { ...theme.type.bodyMd, color: theme.colors.error },
        row: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, alignItems: 'center' },
        button: {
          minWidth: 44,
          minHeight: 44,
          paddingHorizontal: SPACING.md,
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
        },
        selected: {
          borderWidth: 2,
          borderColor: theme.colors.primary,
          backgroundColor: theme.colors.primaryContainer,
        },
        disabled: { opacity: 0.5 },
        color: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
        preview: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48 },
      }),
    [theme, insets.bottom],
  );
  const persistRemote = async (clear = false) => {
    if (useIdentityStore.getState().owner !== store.owner) return;
    try {
      await syncIdentity(clear);
    } catch {
      setError(t('settings.identitySyncError'));
    }
  };
  const syncChoice = () => {
    setBusy(true);
    setError('');
    void persistRemote().finally(() => setBusy(false));
  };
  const select = async () => {
    const selectionOwner = store.owner;
    setError('');
    setBusy(true);
    try {
      const photo = await pickPhoto();
      if (photo && useIdentityStore.getState().owner === selectionOwner) setPreview(photo);
    } catch (cause) {
      setError(
        t(
          cause instanceof Error && cause.message === 'permission-denied'
            ? 'settings.identityPermission'
            : 'settings.identityPhotoError',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!preview) return;
    const owner = store.owner;
    const oldUri = identity.localPhotoUri;
    setError('');
    setBusy(true);
    try {
      const uri = await saveLocalPhoto(preview);
      if (useIdentityStore.getState().owner !== owner) {
        await removeLocalPhoto(uri);
        return;
      }
      useIdentityStore.getState().setLocalPhoto(uri);
      removePhotoPreview(preview);
      setPreview(undefined);
      await removeLocalPhoto(oldUri);
      await persistRemote();
    } catch {
      setError(t('settings.identityPhotoError'));
    } finally {
      setBusy(false);
    }
  };
  const clear = async () => {
    setError('');
    setBusy(true);
    const uri = identity.localPhotoUri;
    store.clearPhoto();
    try {
      await persistRemote(true);
      await removeLocalPhoto(uri);
    } catch {
      setError(t('settings.identityPhotoError'));
    } finally {
      setBusy(false);
    }
  };
  const action = (label: string, onPress: () => void, selected = false) => (
    <TouchableOpacity
      key={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy || !active, selected }}
      disabled={busy || !active}
      onPress={onPress}
      style={[styles.button, selected && styles.selected, busy && styles.disabled]}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
  const close = () => {
    if (!busy) {
      setPreview(undefined);
      setError('');
      onClose();
    }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.row}>
              <Text style={styles.title} accessibilityRole="header">
                {t('settings.identity')}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                disabled={busy}
                accessibilityState={{ disabled: busy }}
                onPress={close}
                style={[styles.button, busy && styles.disabled]}
              >
                <Text style={styles.label}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
            <Avatar
              name={name}
              size="lg"
              source={preview || identity.localPhotoUri || identity.photoUrl}
              accentColor={identity.accentColor}
              detail={identity.detail}
              style={styles.preview}
            />
            <View style={styles.row}>
              {action(t('settings.identityChangePhoto'), () => void select())}
              {identity.avatarSource === 'photo' && !preview
                ? action(t('settings.identityRemovePhoto'), () => void clear())
                : null}
            </View>
            {preview ? (
              <View style={styles.row}>
                {action(t('settings.identityUsePhoto'), () => void save())}
                {action(t('common.cancel'), () => setPreview(undefined))}
              </View>
            ) : null}
            {busy ? (
              <ActivityIndicator
                accessibilityLabel={t('settings.identityBusy')}
                color={theme.colors.primary}
              />
            ) : null}
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {identity.pending && (error || store.owner !== 'local')
              ? action(t('settings.identityRetry'), () => {
                  setBusy(true);
                  setError('');
                  void persistRemote(identity.avatarSource !== 'photo').finally(() =>
                    setBusy(false),
                  );
                })
              : null}
            <Text style={styles.label}>{t('settings.identityColor')}</Text>
            <View style={styles.row}>
              {IDENTITY_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  accessibilityRole="radio"
                  accessibilityLabel={t(`settings.identityColor.${color}`)}
                  accessibilityState={{
                    selected: identity.accentColor === color,
                    disabled: busy || !active,
                  }}
                  disabled={busy || !active}
                  onPress={() => {
                    store.setAccentColor(color);
                    syncChoice();
                  }}
                  style={[
                    styles.color,
                    {
                      backgroundColor: IDENTITY_PALETTE[color],
                      borderColor:
                        identity.accentColor === color ? theme.colors.onSurface : 'transparent',
                    },
                    busy && styles.disabled,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.label}>{t('settings.identityDetail')}</Text>
            <View style={styles.row}>
              {(['generated', 'initial', 'emoji'] as const).map((source) =>
                action(
                  t(`settings.identityDetail.${source}`),
                  () => {
                    store.setDetail(source, source === 'emoji' ? IDENTITY_EMOJIS[0] : undefined);
                    syncChoice();
                  },
                  source === 'emoji'
                    ? Boolean(identity.detail)
                    : !identity.detail && identity.avatarSource === source,
                ),
              )}
            </View>
            {identity.detail ? (
              <View style={styles.row}>
                {IDENTITY_EMOJIS.map((emoji) =>
                  action(
                    emoji,
                    () => {
                      store.setDetail('emoji', emoji);
                      syncChoice();
                    },
                    identity.detail === emoji,
                  ),
                )}
              </View>
            ) : null}
            <View style={styles.row}>
              <Avatar
                name={name}
                size="sm"
                source={identity.localPhotoUri || identity.photoUrl}
                accentColor={identity.accentColor}
                detail={identity.detail}
              />
              <Text style={styles.body}>{t('settings.identityHeaderPreview')}</Text>
            </View>
            <Text style={styles.body}>
              {t(
                store.owner !== 'local' && identity.pending === false
                  ? 'settings.identitySynced'
                  : 'settings.identityLocal',
              )}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
