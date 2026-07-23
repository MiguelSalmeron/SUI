import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';

/** Color cálido del fuego (fuera de la paleta azul base, intencional). */
const FLAME = '#FF7A1A';

type Props = {
  /** Días consecutivos cumpliendo. 0 = sin racha activa. */
  streak: number;
};

/**
 * Insignia de RACHA (estilo Duolingo): número grande + fuego que late al
 * subir. Refuerza la constancia diaria, métrica clave del piloto SUI.
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
      <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>
        {active ? '🔥' : '✨'}
      </Animated.Text>
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
            <Text style={styles.label}>cumple una meta hoy 🔥</Text>
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
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  cardActive: {
    backgroundColor: '#FFF4EC',
    borderColor: '#FFD9BF',
  },
  cardIdle: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  flame: {
    fontSize: 40,
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
    color: COLORS.text,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
