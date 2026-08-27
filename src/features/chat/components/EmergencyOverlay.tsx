import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { CrisisConfig } from '../services/crisisConfig';

interface EmergencyOverlayProps {
  visible: boolean;
  config: CrisisConfig;
  onClose: () => void;
}

/**
 * Overlay de derivación inmediata ante señales de crisis.
 * Botones interactivos que abren el marcador telefónico (tel:).
 */
export const EmergencyOverlay = ({
  visible,
  config,
  onClose,
}: EmergencyOverlayProps) => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const call = async (phone: string) => {
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Llamada no disponible', `Marca manualmente: ${phone}`);
      }
    } catch {
      Alert.alert('Llamada no disponible', `Marca manualmente: ${phone}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>♥</Text>
          </View>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{config.message}</Text>

          <View style={styles.contacts}>
            {config.contacts.map((c) => (
              <TouchableOpacity
                key={`${c.label}-${c.phone}`}
                style={styles.contactBtn}
                onPress={() => call(c.phone)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Llamar a ${c.label}`}
                accessibilityHint={`Abre el marcador con el número ${c.phone}`}
              >
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactPhone}>Llamar {c.phone}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Seguir conversando"
          >
            <Text style={styles.closeText}>Seguir conversando</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = ({ colors, type }: AppTheme) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  badgeText: {
    color: colors.onError,
    fontSize: type.headlineMd.fontSize,
    lineHeight: type.headlineMd.lineHeight,
  },
  title: {
    ...type.headlineSm,
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    ...type.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  contacts: {
    width: '100%',
    gap: SPACING.sm,
  },
  contactBtn: {
    backgroundColor: colors.error,
    borderRadius: 18,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  contactLabel: {
    ...type.titleMd,
    color: colors.onError,
  },
  contactPhone: {
    ...type.labelMd,
    color: colors.onError,
    opacity: 0.95,
    marginTop: 2,
  },
  closeBtn: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  closeText: {
    ...type.labelLg,
    color: colors.primary,
  },
});
