import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';
import { CrisisConfig } from '../../services/crisisConfig';

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
              >
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactPhone}>Llamar {c.phone}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Seguir conversando</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 20, 60, 0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: MD3_COLORS.surface,
    borderRadius: 26,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MD3_COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  badgeText: {
    color: MD3_COLORS.surface,
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: MD3_COLORS.onSurface,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: MD3_COLORS.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  contacts: {
    width: '100%',
    gap: SPACING.sm,
  },
  contactBtn: {
    backgroundColor: MD3_COLORS.error,
    borderRadius: 18,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  contactLabel: {
    color: MD3_COLORS.surface,
    fontWeight: '900',
    fontSize: 16,
  },
  contactPhone: {
    color: MD3_COLORS.surface,
    opacity: 0.95,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  closeText: {
    color: MD3_COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
  },
});
