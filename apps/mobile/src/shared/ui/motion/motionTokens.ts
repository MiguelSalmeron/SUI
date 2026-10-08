import { Easing } from 'react-native';

export const MOTION = {
  springs: {
    settle: { speed: 12, bounciness: 6 },
    bounce: { speed: 40, bounciness: 14 },
  },
  durations: {
    quick: 180,
    smooth: 320,
    gentle: 450,
    breathe: 1800,
  },
  easings: {
    standard: Easing.bezier(0.2, 0.0, 0, 1.0),
    decelerate: Easing.out(Easing.cubic),
    accelerate: Easing.in(Easing.cubic),
    gentle: Easing.bezier(0.25, 0.1, 0.25, 1.0),
  },
  distances: {
    subtle: 8,
    standard: 16,
    prominent: 28,
  },
} as const;
