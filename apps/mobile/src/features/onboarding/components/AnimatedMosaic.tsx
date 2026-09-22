import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@/shared/ui/Ionicons';
import { SPACING, type AppTheme, useAppTheme } from '@/shared/theme/theme';
import { SuiDoodle } from '@/shared/ui/SuiDoodle';
import { MOTION } from '@/shared/ui/motion/motionTokens';

interface AnimatedMosaicProps {
  compact?: boolean;
}

/** Anillo de progreso del tile hero (columna 3). */
const RING_SIZE = 40;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_PROGRESS = 0.68;

/** Rejilla de Agenda: 12 celdas, una marcada como "hoy". */
const CALENDAR_CELLS = 12;
const CALENDAR_TODAY = 7;

const HABIT_DOTS = 5;

/**
 * Curva de tendencia ascendente del tile "Progreso".
 *
 * Un único cubic garantiza tangentes continuas (sin quiebres) y las
 * proporciones se mantienen con margen simétrico en el viewBox, cosa que el
 * doodle `path` genérico no hacía a este tamaño.
 */
const TREND_VIEWBOX = '0 0 120 68';
const TREND_LINE = 'M12 56 C 46 56 62 18 104 16';
const TREND_AREA = `${TREND_LINE} L104 62 L12 62 Z`;

const ProgressTrend = ({ width, color }: { width: number; color: string }) => (
  <Svg width={width} height={(width * 68) / 120} viewBox={TREND_VIEWBOX}>
    <Path d={TREND_AREA} fill={color} fillOpacity={0.16} />
    <Path
      d={TREND_LINE}
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle cx={12} cy={56} r={3.5} fill={color} />
    <Circle cx={104} cy={16} r={5} fill={color} />
  </Svg>
);

/**
 * Mosaico decorativo de bienvenida. Representa Meta, Hábito, Agenda y
 * Progreso sin datos reales. Queda fuera del lector de pantalla.
 *
 * Nota de color: cada tile usa tokens semánticos resueltos por scheme, así
 * que en dark mode ningún tile se funde con `colors.background` (el caso del
 * antiguo tile navy hardcodeado).
 */
export const AnimatedMosaic = ({ compact = false }: AnimatedMosaicProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const { colors } = theme;

  const col1Anim = useRef(new Animated.Value(0)).current;
  const col2Anim = useRef(new Animated.Value(0)).current;
  const col3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (reduceMotion) {
          col1Anim.setValue(1);
          col2Anim.setValue(1);
          col3Anim.setValue(1);
          return;
        }

        Animated.stagger(90, [
          Animated.timing(col1Anim, {
            toValue: 1,
            duration: MOTION.durations.smooth,
            easing: MOTION.easings.decelerate,
            useNativeDriver: true,
          }),
          Animated.timing(col2Anim, {
            toValue: 1,
            duration: MOTION.durations.smooth,
            easing: MOTION.easings.decelerate,
            useNativeDriver: true,
          }),
          Animated.timing(col3Anim, {
            toValue: 1,
            duration: MOTION.durations.smooth,
            easing: MOTION.easings.decelerate,
            useNativeDriver: true,
          }),
        ]).start();
      })
      .catch(() => {
        col1Anim.setValue(1);
        col2Anim.setValue(1);
        col3Anim.setValue(1);
      });
  }, [col1Anim, col2Anim, col3Anim]);

  const makeColStyle = (anim: Animated.Value, distance: number) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [distance, 0],
        }),
      },
    ],
  });

  return (
    <View
      style={styles.mosaic}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Columna 1 — Meta (brote + barras de avance) y racha (llama) */}
      <Animated.View style={[styles.mosaicColumn, makeColStyle(col1Anim, 18)]}>
        <View style={[styles.tile, styles.tileTall, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="sprout" size={compact ? 46 : 56} color={colors.primary} />
          <View style={styles.miniBars}>
            <View style={[styles.miniBar, styles.miniBarFull, { backgroundColor: colors.primary }]} />
            <View style={[styles.miniBar, styles.miniBarMid, { backgroundColor: colors.primary }]} />
            <View
              style={[styles.miniBar, styles.miniBarShort, { backgroundColor: colors.primary }]}
            />
          </View>
        </View>

        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.flameContainer }]}>
          <Ionicons name="flame" size={compact ? 24 : 27} color={colors.flame} />
          <View style={styles.dotsRow}>
            {Array.from({ length: HABIT_DOTS }, (_, index) => (
              <View key={index} style={[styles.dot, { backgroundColor: colors.flame }]} />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Columna 2 — Progreso (acento salvia + badge) y Agenda */}
      <Animated.View
        style={[styles.mosaicColumn, styles.middleColumn, makeColStyle(col2Anim, 24)]}
      >
        <View
          style={[styles.tile, styles.tileShort, { backgroundColor: colors.secondaryContainer }]}
        >
          <ProgressTrend width={compact ? 46 : 54} color={colors.secondary} />
          <View
            style={[
              styles.tileBadge,
              { backgroundColor: colors.surface, borderColor: colors.secondary },
            ]}
          >
            <Ionicons name="trending-up" size={14} color={colors.secondary} />
          </View>
        </View>

        <View
          style={[styles.tile, styles.tileTall, { backgroundColor: colors.surfaceContainerHighest }]}
        >
          <Ionicons name="calendar-outline" size={compact ? 26 : 30} color={colors.primary} />
          <View style={styles.calendarGrid}>
            {Array.from({ length: CALENDAR_CELLS }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.calendarDot,
                  {
                    backgroundColor:
                      index === CALENDAR_TODAY ? colors.flame : colors.outlineVariant,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Columna 3 — Meta hero (anillo) y hábito cumplido (check) */}
      <Animated.View style={[styles.mosaicColumn, makeColStyle(col3Anim, 20)]}>
        <View
          style={[styles.tile, styles.tileTall, styles.heroTile, { backgroundColor: colors.inverseSurface }]}
        >
          <Ionicons
            name="flag-outline"
            size={compact ? 26 : 30}
            color={colors.inversePrimary}
          />
          <View style={styles.ringWrap}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.outlineVariant}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={colors.inversePrimary}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - RING_PROGRESS)}
                fill="none"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
          </View>
        </View>

        <View style={[styles.tile, styles.tileShort, { backgroundColor: colors.primaryContainer }]}>
          <SuiDoodle variant="rhythm" size={compact ? 38 : 44} color={colors.primary} />
          <View
            style={[
              styles.tileBadge,
              { backgroundColor: colors.surface, borderColor: colors.primary },
            ]}
          >
            <Ionicons name="checkmark" size={14} color={colors.primary} />
          </View>
        </View>
      </Animated.View>

      {/* Fundido inferior real: gradiente hacia el fondo, no una banda sólida. */}
      <View style={styles.mosaicFade}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="mosaicFadeGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#mosaicFadeGradient)" />
        </Svg>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme, compact: boolean) =>
  StyleSheet.create({
    mosaic: {
      flexDirection: 'row',
      height: compact ? 150 : 184,
      gap: SPACING.xs,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: SPACING.md,
    },
    mosaicColumn: {
      flex: 1,
      gap: SPACING.xs,
    },
    middleColumn: {
      paddingTop: SPACING.sm,
    },
    tile: {
      borderRadius: theme.radius.xl,
      // Borde de 1px igual que `welcomeCard`: en light los contenedores pastel
      // quedan a ~1.1:1 del fondo, así que el borde es lo que define el tile.
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    heroTile: {
      borderWidth: 0,
    },
    tileTall: {
      flex: 1.5,
    },
    tileShort: {
      flex: 1,
    },
    tileBadge: {
      position: 'absolute',
      right: 6,
      bottom: 6,
      width: 26,
      height: 26,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    miniBars: {
      gap: 4,
      width: '62%',
      marginTop: 8,
    },
    miniBar: {
      height: 3,
      borderRadius: 2,
      opacity: 0.75,
    },
    miniBarFull: {
      width: '100%',
    },
    miniBarMid: {
      width: '72%',
    },
    miniBarShort: {
      width: '44%',
    },
    dotsRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 8,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      opacity: 0.6,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 50,
      gap: 4,
      marginTop: 8,
      justifyContent: 'center',
    },
    calendarDot: {
      width: 6,
      height: 6,
      borderRadius: 2,
    },
    ringWrap: {
      marginTop: 9,
    },
    mosaicFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 54,
      // `pointerEvents` va en el style: la prop está deprecada en RN Web.
      pointerEvents: 'none',
    },
  });
