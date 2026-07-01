import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { MD3_COLORS, SPACING } from '../../theme/theme';

type Props = {
  /** Número de items completados hoy (metas + hábitos). */
  completed: number;
  /** Número total de items del día. */
  total: number;
  /** Acción opcional al pulsar (p. ej. abrir reporte). */
  label?: string;
};

/**
 * Barra de progreso diario en tiempo real. Se anima cada vez que cambia el
 * porcentaje de cumplimiento (al marcar/desmarcar una meta o hábito).
 */
export const DailyProgress = ({ completed, total, label }: Props) => {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const message =
    total === 0
      ? 'Agrega metas o hábitos para empezar a medir tu día.'
      : percent === 100
      ? '¡Día completo! Excelente trabajo'
      : `${completed} de ${total} ${label ?? 'completados'} hoy`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Progreso de hoy</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>

      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: MD3_COLORS.surface,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: MD3_COLORS.outlineVariant,
    shadowColor: MD3_COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: MD3_COLORS.onSurface,
  },
  percent: {
    fontSize: 18,
    fontWeight: '900',
    color: MD3_COLORS.primary,
  },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: MD3_COLORS.outlineVariant,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: MD3_COLORS.success,
  },
  message: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: MD3_COLORS.onSurfaceVariant,
    fontWeight: '600',
  },
});
