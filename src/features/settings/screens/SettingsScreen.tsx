import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppTheme, ColorScheme, SPACING, TypographyScale, useAppTheme, useThemeController, ThemeMode } from '@/shared/theme/theme';
import { useSettingsStore, FontSize } from '@/shared/preferences/useSettingsStore';
import { useOnboardingStore } from '@/features/onboarding/store/useOnboardingStore';
import { useHomeStore } from '@/shared/domain/productivity/useHomeStore';
import { HOME_STATE_KEY } from '@/shared/domain/productivity/homeStorage';
import { userHasGoogleProvider } from '@/features/auth/services/googleAuth';
import { useGoogleAuth } from '@/features/auth/hooks/useGoogleAuth';
import { AuthContext } from '@/features/auth/context/AuthContext';
import {
  scheduleNightlyReport,
  cancelNightlyReport,
} from '../services/notifications';
import type { RootStackParamList } from '@/application/navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ──────────────────────────────────────────────────────────
// Icons MD3 para cada sección
// ──────────────────────────────────────────────────────────
const SECTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  appearance: 'color-palette-outline',
  general: 'options-outline',
  account: 'person-outline',
};

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Claro',
  dark: 'Oscuro',
  system: 'Sistema',
};

const THEME_ICONS: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
  light: 'sunny-outline',
  dark: 'moon-outline',
  system: 'phone-portrait-outline',
};

const FONT_LABELS: Record<FontSize, string> = {
  small: 'Pequeño',
  medium: 'Mediano',
  large: 'Grande',
};

// ──────────────────────────────────────────────────────────
// Componente interno: SettingsRow
// ──────────────────────────────────────────────────────────
interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  colors: ColorScheme;
  type: TypographyScale;
  destructive?: boolean;
}

const SettingsRow = React.memo<SettingsRowProps>(
  ({ icon, label, description, right, onPress, colors, type, destructive }) => (
    <TouchableOpacity
      style={rowStyles(colors, type).row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      <View style={rowStyles(colors, type).iconContainer}>
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? colors.error : colors.primary}
        />
      </View>
      <View style={rowStyles(colors, type).content}>
        <Text style={[rowStyles(colors, type).label, destructive && { color: colors.error }]}>
          {label}
        </Text>
        {description ? (
          <Text style={rowStyles(colors, type).description}>{description}</Text>
        ) : null}
      </View>
      {right ? (
        <View style={rowStyles(colors, type).right}>{right}</View>
      ) : null}
    </TouchableOpacity>
  ),
);

const rowStyles = (colors: ColorScheme, type: TypographyScale) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      minHeight: 56,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceContainerHigh,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
    },
    content: {
      flex: 1,
    },
    label: {
      ...type.titleMd,
      color: colors.onSurface,
    },
    description: {
      ...type.bodySm,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    right: {
      marginLeft: SPACING.sm,
    },
  });

// ──────────────────────────────────────────────────────────
// Componente interno: SectionHeader
// ──────────────────────────────────────────────────────────
interface SectionHeaderProps {
  title: string;
  iconKey: string;
  colors: ColorScheme;
  type: TypographyScale;
}

const SectionHeader = ({ title, iconKey, colors, type }: SectionHeaderProps) => (
  <View style={sectionStyles(colors, type).header}>
    <Ionicons
      name={SECTION_ICONS[iconKey] ?? 'ellipse-outline'}
      size={16}
      color={colors.primary}
      style={sectionStyles(colors, type).headerIcon}
    />
    <Text style={sectionStyles(colors, type).headerTitle}>{title}</Text>
  </View>
);

const sectionStyles = (colors: ColorScheme, type: TypographyScale) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xs,
    },
    headerIcon: {
      marginRight: SPACING.sm,
    },
    headerTitle: {
      ...type.labelMd,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.primary,
    },
  });

// ──────────────────────────────────────────────────────────
// Pantalla principal: SettingsScreen
// ──────────────────────────────────────────────────────────
export const SettingsScreen = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) => {
  const theme = useAppTheme();
  const { colors, type } = theme;
  const { mode, setMode } = useThemeController();
  const { notificationsEnabled, fontSize, setNotificationsEnabled, setFontSize } =
    useSettingsStore();
  const { user } = useContext(AuthContext);
  const loadState = useHomeStore((s) => s.loadState);
  const { signInWithGoogle, busy: googleBusy, ready: googleReady, configured: googleConfigured } =
    useGoogleAuth();

  const styles = useMemo(() => createStyles(theme), [theme]);
  const dialogStyles = useMemo(() => modalStyles(theme), [theme]);

  const linkedGoogle = userHasGoogleProvider(user);
  const syncPending = useOnboardingStore((s) => s.syncPending);
  const syncDescription = syncPending
    ? 'Pendiente de sincronizar · se respaldará cuando vuelva la conexión'
    : user?.uid
      ? 'En la nube · respaldo con tu sesión actual'
      : 'Datos locales · permanecen en este dispositivo';
  const syncBadgeLabel = syncPending ? 'Pendiente' : user?.uid ? 'Nube' : 'Local';
  const syncIcon: keyof typeof Ionicons.glyphMap = syncPending
    ? 'cloud-offline-outline'
    : user?.uid
      ? 'cloud-done-outline'
      : 'phone-portrait-outline';
  const accountLabel = linkedGoogle
    ? user?.displayName || user?.email || 'Cuenta Google'
    : user?.isAnonymous
      ? 'Sesión local (anónima)'
      : user?.email || 'Cuenta';
  const accountDescription = linkedGoogle
    ? user?.email || 'Vinculada con Google'
    : 'Vincula Google para recuperar tu progreso en otros dispositivos';

  const cycleThemeMode = () => {
    const next: ThemeMode =
      mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    void setMode(next);
  };

  const cycleFontSize = () => {
    const order: FontSize[] = ['small', 'medium', 'large'];
    const idx = order.indexOf(fontSize);
    setFontSize(order[(idx + 1) % order.length]);
  };

  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const setProfileName = useOnboardingStore((s) => s.setName);
  const profileName = useOnboardingStore((s) => s.profile.name);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [logoutState, setLogoutState] = useState<
    'idle' | 'logging' | 'error'
  >('idle');
  const [logoutError, setLogoutError] = useState<string>('');
  const [googleLinkState, setGoogleLinkState] = useState<
    'idle' | 'linking' | 'error' | 'success'
  >('idle');
  const [googleLinkError, setGoogleLinkError] = useState('');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const googleLinkBusy = googleBusy || googleLinkState === 'linking';

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const performLogout = () => {
    setConfirmVisible(false);
    setLogoutError('');
    setLogoutState('logging');
    (async () => {
      try {
        resetOnboarding();
        await AsyncStorage.removeItem(HOME_STATE_KEY);
        await signOut(auth);
        setLogoutState('idle');
      } catch (err) {
        console.error('Error al cerrar sesión:', err);
        setLogoutError(
          err instanceof Error ? err.message : 'Error desconocido al cerrar sesión.',
        );
        setLogoutState('error');
      }
    })();
  };

  const handleLogout = () => setConfirmVisible(true);

  const handleLinkGoogle = async () => {
    if (!googleConfigured) {
      setGoogleLinkError(
        'Google no configurado. Añade EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID (ver todolist.md).',
      );
      setGoogleLinkState('error');
      return;
    }
    setGoogleLinkError('');
    setGoogleLinkState('linking');
    const result = await signInWithGoogle();
    if (result.cancelled) {
      setGoogleLinkState('idle');
      return;
    }
    if (!result.ok) {
      setGoogleLinkError(result.error || 'No se pudo vincular Google.');
      setGoogleLinkState('error');
      return;
    }

    const displayName = auth.currentUser?.displayName?.trim();
    if (displayName && !profileName?.trim()) {
      setProfileName(displayName);
    }

    await loadState();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    setGoogleLinkState('success');
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setGoogleLinkState('idle'), 1200);
  };

  return (
    <View style={styles.screen}>
      {/* Header nativo de React Navigation */}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── APARIENCIA ─── */}
        <SectionHeader title="Apariencia" iconKey="appearance" colors={colors} type={type} />
        <View style={styles.card}>
          <SettingsRow
            icon={THEME_ICONS[mode]}
            label="Modo de tema"
            description={THEME_LABELS[mode]}
            onPress={cycleThemeMode}
            colors={colors}
            type={type}
            right={
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{THEME_LABELS[mode]}</Text>
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={FONT_ICONS[fontSize]}
            label="Tamaño de fuente"
            description={FONT_LABELS[fontSize]}
            onPress={cycleFontSize}
            colors={colors}
            type={type}
            right={
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{FONT_LABELS[fontSize]}</Text>
              </View>
            }
          />
        </View>

        {/* ─── GENERAL ─── */}
        <SectionHeader title="General" iconKey="general" colors={colors} type={type} />
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            label="Notificaciones"
            description="Recordatorios y alertas de la app"
            colors={colors}
            type={type}
            right={
              <Switch
                value={notificationsEnabled}
                onValueChange={(enabled) => {
                  setNotificationsEnabled(enabled);
                  if (enabled) {
                    void scheduleNightlyReport();
                  } else {
                    void cancelNightlyReport();
                  }
                }}
                trackColor={{
                  false: colors.surfaceContainerHighest,
                  true: colors.primaryContainer,
                }}
                thumbColor={notificationsEnabled ? colors.primary : colors.onSurfaceVariant}
              />
            }
          />
        </View>

        {/* ─── CUENTA ─── */}
        <SectionHeader title="Cuenta" iconKey="account" colors={colors} type={type} />
        <View style={styles.card}>
          <SettingsRow
            icon={syncIcon}
            label="Estado de datos"
            description={syncDescription}
            colors={colors}
            type={type}
            right={
              <View
                style={[
                  styles.badge,
                  syncPending
                    ? styles.syncPendingBadge
                    : !user?.uid
                      ? styles.syncLocalBadge
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    syncPending
                      ? styles.syncPendingText
                      : !user?.uid
                        ? styles.syncLocalText
                        : null,
                  ]}
                >
                  {syncBadgeLabel}
                </Text>
              </View>
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={linkedGoogle ? 'logo-google' : 'person-outline'}
            label={accountLabel}
            description={accountDescription}
            colors={colors}
            type={type}
            right={
              linkedGoogle ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Google</Text>
                </View>
              ) : null
            }
          />
          {!linkedGoogle ? (
            <>
              <View style={styles.divider} />
              <SettingsRow
                icon="logo-google"
                label="Vincular con Google"
                description={
                  !googleConfigured
                    ? 'Falta configurar Client ID (todolist.md)'
                    : !googleReady
                      ? 'Preparando Google…'
                      : 'Recupera tu progreso en web y otros dispositivos'
                }
                onPress={
                  googleLinkBusy || !googleConfigured || !googleReady
                    ? undefined
                    : () => void handleLinkGoogle()
                }
                colors={colors}
                type={type}
                right={
                  googleLinkBusy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : null
                }
              />
            </>
          ) : null}
          <View style={styles.divider} />
          <SettingsRow
            icon="log-out-outline"
            label="Cerrar sesión"
            description="Salir de tu cuenta actual"
            onPress={handleLogout}
            colors={colors}
            type={type}
            destructive
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Sui v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Modal de confirmación de cierre de sesión (más confiable que Alert nativo en Expo Go) */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={dialogStyles.overlay}>
          <View style={dialogStyles.card} accessibilityRole="alert">
            <View style={dialogStyles.hero}>
              <View style={dialogStyles.iconWrap}>
                <Ionicons name="log-out-outline" size={26} color={colors.error} />
              </View>
              <Text style={dialogStyles.title}>Cerrar sesión</Text>
            </View>
            <Text style={dialogStyles.message}>
              ¿Estás seguro de que quieres cerrar sesión? Tendrás que volver a
              configurar tu experiencia.
            </Text>
            <View style={dialogStyles.actions}>
              <TouchableOpacity
                style={dialogStyles.cancelBtn}
                onPress={() => setConfirmVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancelar cierre de sesión"
              >
                <Text style={dialogStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dialogStyles.confirmBtn}
                onPress={performLogout}
                accessibilityRole="button"
                accessibilityLabel="Confirmar cerrar sesión"
              >
                <Text style={dialogStyles.confirmText}>
                  Cerrar sesión
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de progreso / error de cierre de sesión */}
      <Modal
        visible={logoutState !== 'idle'}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutState('idle')}
      >
        <View style={dialogStyles.overlay}>
          <View style={dialogStyles.card} accessibilityRole="alert">
            {logoutState === 'logging' ? (
              <View style={dialogStyles.hero}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={dialogStyles.title}>Cerrando sesión...</Text>
              </View>
            ) : (
              <>
                <View style={dialogStyles.hero}>
                  <View style={dialogStyles.iconWrap}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={26}
                      color={colors.error}
                    />
                  </View>
                  <Text style={dialogStyles.title}>
                    No se pudo cerrar sesión
                  </Text>
                </View>
                <Text style={dialogStyles.message}>
                  {logoutError || 'Ocurrió un error inesperado.'}
                </Text>
                <TouchableOpacity
                  style={[dialogStyles.confirmBtn, dialogStyles.fullWidthBtn]}
                  onPress={() => setLogoutState('idle')}
                  accessibilityRole="button"
                  accessibilityLabel="Entendido"
                >
                  <Text style={dialogStyles.confirmText}>Entendido</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      {/* Modal progreso / error vincular Google */}
      <Modal
        visible={googleLinkState === 'linking' || googleLinkState === 'error' || googleLinkState === 'success'}
        transparent
        animationType="fade"
        onRequestClose={() => setGoogleLinkState('idle')}
      >
        <View style={dialogStyles.overlay}>
          <View style={dialogStyles.card} accessibilityRole="alert">
            {googleLinkState === 'linking' ? (
              <View style={dialogStyles.hero}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={dialogStyles.title}>Vinculando Google...</Text>
              </View>
            ) : googleLinkState === 'success' ? (
              <View style={dialogStyles.hero}>
                <View style={[dialogStyles.iconWrap, { backgroundColor: colors.primaryContainer }]}>
                  <Ionicons name="checkmark-circle" size={26} color={colors.primary} />
                </View>
                <Text style={dialogStyles.title}>Cuenta vinculada</Text>
              </View>
            ) : (
              <>
                <View style={dialogStyles.hero}>
                  <View style={dialogStyles.iconWrap}>
                    <Ionicons name="alert-circle-outline" size={26} color={colors.error} />
                  </View>
                  <Text style={dialogStyles.title}>No se pudo vincular</Text>
                </View>
                <Text style={dialogStyles.message}>
                  {googleLinkError || 'Ocurrió un error inesperado.'}
                </Text>
                <TouchableOpacity
                  style={[dialogStyles.confirmBtn, dialogStyles.fullWidthBtn]}
                  onPress={() => setGoogleLinkState('idle')}
                  accessibilityRole="button"
                  accessibilityLabel="Entendido"
                >
                  <Text style={dialogStyles.confirmText}>Entendido</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Mapa de iconos por tamaño de fuente
const FONT_ICONS: Record<FontSize, keyof typeof Ionicons.glyphMap> = {
  small: 'text-outline',
  medium: 'text-outline',
  large: 'text-outline',
};

// ──────────────────────────────────────────────────────────
// Estilos MD3
// ──────────────────────────────────────────────────────────
const createStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingBottom: SPACING.xl * 2,
    },
    card: {
      backgroundColor: colors.surfaceContainer,
      marginHorizontal: SPACING.lg,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant,
      marginLeft: 72,
    },
    badge: {
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: SPACING.sm + 2,
      paddingVertical: SPACING.xs,
      borderRadius: 12,
    },
    badgeText: {
      ...type.labelMd,
      color: colors.onPrimaryContainer,
    },
    syncPendingBadge: {
      backgroundColor: colors.flameContainer,
    },
    syncPendingText: {
      color: colors.onFlameContainer,
    },
    syncLocalBadge: {
      backgroundColor: colors.surfaceContainerHighest,
    },
    syncLocalText: {
      color: colors.onSurfaceVariant,
    },
    footer: {
      alignItems: 'center',
      marginTop: SPACING.xl,
      paddingBottom: SPACING.lg,
    },
    footerText: {
      ...type.labelMd,
      color: colors.onSurfaceVariant,
    },
  });

// ──────────────────────────────────────────────────────────
// Estilos del modal de logout (MD3)
// ──────────────────────────────────────────────────────────
const modalStyles = ({ colors, type }: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.lg,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surfaceContainer,
      borderRadius: 24,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      alignItems: 'center',
    },
    hero: {
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.sm,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.errorContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      ...type.titleLg,
      color: colors.onSurface,
      textAlign: 'center',
    },
    message: {
      ...type.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.xs,
      marginBottom: SPACING.lg,
      alignSelf: 'stretch',
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
      alignSelf: 'stretch',
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHighest,
    },
    cancelText: {
      ...type.titleMd,
      color: colors.onSurface,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      alignItems: 'center',
      backgroundColor: colors.error,
    },
    fullWidthBtn: {
      alignSelf: 'stretch',
      flex: 0,
    },
    confirmText: {
      ...type.titleMd,
      color: colors.onError,
    },
  });
