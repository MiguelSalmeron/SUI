import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme, MD3_RADIUS, SPACING, useAppTheme } from '../../theme/theme';

type Props = {
  /** Días consecutivos cumpliendo. 0 = sin racha activa. */
  streak: number;
};

/**
 * Insignia de RACHA: número grande + indicador visual que late al subir.
 * Refuerza la constancia diaria, métrica clave del piloto SUI.
 *
 * Si la racha es 0, invita a empezar (sin culpar).
 */
export const StreakBadge = ({ streak }: Props) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(1)).current;
  const active = streak > 0;

  // Late cada vez que la racha sube (feedback de recompensa).
  useEffect(() => {
    if (!active) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.25, useNativeDriver: true, speed: 20 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 12 }),
    ]).start();
  }, [streak, active, scale]);

  return (
    <View style={[styles.card, active ? styles.cardActive : styles.cardIdle]}>
      <Animated.View
        style={[
          styles.dot,
          active ? styles.dotActive : styles.dotIdle,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={active ? 'flame' : 'flame-outline'}
          size={20}
          color={active ? colors.surface : colors.primary}
        />
      </Animated.View>
      <View style={styles.textCol}>
        {active ? (
          <>
            <Text style={styles.count}>
              {streak} {streak === 1 ? 'día' : 'días'}
            </Text>
            <Text style={styles.label}>de racha · vas construyendo constancia</Text>
          </>
        ) : (
          <>
            <Text style={styles.countIdle}>Empieza tu racha</Text>
            <Text style={styles.label}>cumple una meta hoy</Text>
          </>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: ColorScheme) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: MD3_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  cardActive: {
    backgroundColor: colors.flameContainer,
    borderColor: colors.flameOutline,
  },
  cardIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: colors.flame,
  },
  dotIdle: {
    backgroundColor: colors.primaryContainer,
  },
  textCol: {
    flex: 1,
  },
  count: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.flame,
  },
  countIdle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.onSurface,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
});
