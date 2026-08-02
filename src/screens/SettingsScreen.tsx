import React, { useMemo, useState } from 'react';
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
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorScheme, SPACING, useAppTheme, useThemeController, ThemeMode } from '../theme/theme';
import { useSettingsStore, FontSize } from '../store/useSettingsStore';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { HOME_STATE_KEY } from '../services/homeStorage';
import {
  scheduleNightlyReport,
  cancelNightlyReport,
} from '../services/notifications';
import type { RootStackParamList } from '../navigation/types';
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
  destructive?: boolean;
}

const SettingsRow = React.memo<SettingsRowProps>(
  ({ icon, label, description, right, onPress, colors, destructive }) => (
    <TouchableOpacity
      style={rowStyles(colors).row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      <View style={rowStyles(colors).iconContainer}>
        <Ionicons
          name={icon}
          size={22}
          color={destructive ? colors.error : colors.primary}
        />
      </View>
      <View style={rowStyles(colors).content}>
        <Text style={[rowStyles(colors).label, destructive && { color: colors.error }]}>
          {label}
        </Text>
        {description ? (
          <Text style={rowStyles(colors).description}>{description}</Text>
        ) : null}
      </View>
      {right ? (
        <View style={rowStyles(colors).right}>{right}</View>
      ) : null}
    </TouchableOpacity>
  ),
);

const rowStyles = (colors: ColorScheme) =>
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
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSurface,
    },
    description: {
      fontSize: 13,
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
}

const SectionHeader = ({ title, iconKey, colors }: SectionHeaderProps) => (
  <View style={sectionStyles(colors).header}>
    <Ionicons
      name={SECTION_ICONS[iconKey] ?? 'ellipse-outline'}
      size={16}
      color={colors.primary}
      style={sectionStyles(colors).headerIcon}
    />
    <Text style={sectionStyles(colors).headerTitle}>{title}</Text>
  </View>
);

const sectionStyles = (colors: ColorScheme) =>
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
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.primary,
    },
  });

// ──────────────────────────────────────────────────────────
// Pantalla principal: SettingsScreen
// ──────────────────────────────────────────────────────────
export const SettingsScreen = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'Settings'>) => {
  const { colors } = useAppTheme();
  const { mode, setMode } = useThemeController();
  const { notificationsEnabled, fontSize, setNotificationsEnabled, setFontSize } =
    useSettingsStore();

  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [logoutState, setLogoutState] = useState<
    'idle' | 'logging' | 'error'
  >('idle');
  const [logoutError, setLogoutError] = useState<string>('');

  const performLogout = () => {
    setConfirmVisible(false);
    setLogoutError('');
    setLogoutState('logging');
    (async () => {
      try {
        resetOnboarding();
        await AsyncStorage.removeItem(HOME_STATE_KEY);
        await signOut(auth);
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

  return (
    <View style={styles.screen}>
      {/* Header nativo de React Navigation */}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── APARIENCIA ─── */}
        <SectionHeader title="Apariencia" iconKey="appearance" colors={colors} />
        <View style={styles.card}>
          <SettingsRow
            icon={THEME_ICONS[mode]}
            label="Modo de tema"
            description={THEME_LABELS[mode]}
            onPress={cycleThemeMode}
            colors={colors}
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
            right={
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{FONT_LABELS[fontSize]}</Text>
              </View>
            }
          />
        </View>

        {/* ─── GENERAL ─── */}
        <SectionHeader title="General" iconKey="general" colors={colors} />
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            label="Notificaciones"
            description="Recordatorios y alertas de la app"
            colors={colors}
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
        <SectionHeader title="Cuenta" iconKey="account" colors={colors} />
        <View style={styles.card}>
          <SettingsRow
            icon="log-out-outline"
            label="Cerrar sesión"
            description="Salir de tu cuenta actual"
            onPress={handleLogout}
            colors={colors}
            destructive
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SUI v1.0.0</Text>
        </View>
      </ScrollView>

      {/* Modal de confirmación de cierre de sesión (más confiable que Alert nativo en Expo Go) */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={modalStyles(colors).overlay}>
          <View style={modalStyles(colors).card}>
            <View style={modalStyles(colors).iconWrap}>
              <Ionicons name="log-out-outline" size={28} color={colors.error} />
            </View>
            <Text style={modalStyles(colors).title}>Cerrar sesión</Text>
            <Text style={modalStyles(colors).message}>
              ¿Estás seguro de que quieres cerrar sesión? Tendrás que volver a
              configurar tu experiencia.
            </Text>
            <View style={modalStyles(colors).actions}>
              <TouchableOpacity
                style={modalStyles(colors).cancelBtn}
                onPress={() => setConfirmVisible(false)}
              >
                <Text style={modalStyles(colors).cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={modalStyles(colors).confirmBtn}
                onPress={performLogout}
              >
                <Text style={modalStyles(colors).confirmText}>
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
        <View style={modalStyles(colors).overlay}>
          <View style={modalStyles(colors).card}>
            {logoutState === 'logging' ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[modalStyles(colors).title, { marginTop: 16 }]}>
                  Cerrando sesión...
                </Text>
              </>
            ) : (
              <>
                <View style={modalStyles(colors).iconWrap}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={28}
                    color={colors.error}
                  />
                </View>
                <Text style={modalStyles(colors).title}>
                  No se pudo cerrar sesión
                </Text>
                <Text style={modalStyles(colors).message}>
                  {logoutError || 'Ocurrió un error inesperado.'}
                </Text>
                <TouchableOpacity
                  style={modalStyles(colors).confirmBtn}
                  onPress={() => setLogoutState('idle')}
                >
                  <Text style={modalStyles(colors).confirmText}>Entendido</Text>
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
const createStyles = (colors: ColorScheme) =>
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
      fontSize: 12,
      fontWeight: '700',
      color: colors.onPrimaryContainer,
    },
    footer: {
      alignItems: 'center',
      marginTop: SPACING.xl,
      paddingBottom: SPACING.lg,
    },
    footerText: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      fontWeight: '600',
    },
  });

// ──────────────────────────────────────────────────────────
// Estilos del modal de logout (MD3)
// ──────────────────────────────────────────────────────────
const modalStyles = (colors: ColorScheme) =>
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
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.errorContainer,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.onSurface,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      marginTop: SPACING.sm,
      marginBottom: SPACING.lg,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      alignItems: 'center',
      backgroundColor: colors.surfaceContainerHighest,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurface,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 20,
      alignItems: 'center',
      backgroundColor: colors.error,
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
