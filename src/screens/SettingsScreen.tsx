import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { ColorScheme, SPACING, useAppTheme, useThemeController, ThemeMode } from '../theme/theme';
import { useSettingsStore, FontSize } from '../store/useSettingsStore';

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
export const SettingsScreen = ({ navigation }: any) => {
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

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => signOut(auth).catch(() => undefined),
        },
      ],
    );
  };

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
                onValueChange={setNotificationsEnabled}
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
