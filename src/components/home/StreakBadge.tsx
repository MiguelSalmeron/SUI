import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MD3_COLORS, MD3_RADIUS, SPACING } from '../../theme/theme';

/** Tono cálido del indicador (fuera de la paleta azul base, intencional). */
const FLAME = '#FF7A1A';

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
      />
      <View style={styles.textCol}>
        {active ? (
          <>
            <Text style={styles.count}>
              {streak} {streak === 1 ? 'día' : 'días'}
            </Text>
            <Text style={styles.label}>de racha · no la rompas</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFF4EC',
    borderColor: '#FFD9BF',
  },
  cardIdle: {
    backgroundColor: MD3_COLORS.surface,
    borderColor: MD3_COLORS.outlineVariant,
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dotActive: {
    backgroundColor: FLAME,
  },
  dotIdle: {
    backgroundColor: MD3_COLORS.primaryContainer,
  },
  textCol: {
    flex: 1,
  },
  count: {
    fontSize: 26,
    fontWeight: '900',
    color: FLAME,
  },
  countIdle: {
    fontSize: 20,
    fontWeight: '900',
    color: MD3_COLORS.onSurface,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: MD3_COLORS.onSurfaceVariant,
    marginTop: 2,
  },
});
