import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { MOTION } from '@/shared/ui/motion/motionTokens';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';

interface UseOrganicEntranceOptions {
  delay?: number;
  duration?: number;
  distance?: number;
  initialScale?: number;
  autoPlay?: boolean;
}

export const useOrganicEntrance = (options: UseOrganicEntranceOptions = {}) => {
  const {
    delay = 0,
    duration = MOTION.durations.smooth,
    distance = MOTION.distances.standard,
    initialScale = 0.96,
    autoPlay = true,
  } = options;
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const play = useCallback(() => {
    animation.current?.stop();
    if (reduceMotion !== false) {
      opacity.setValue(1);
      translateY.setValue(0);
      scale.setValue(1);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(distance);
    scale.setValue(initialScale);
    animation.current = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: MOTION.easings.standard,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: MOTION.easings.decelerate,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration,
        delay,
        easing: MOTION.easings.gentle,
        useNativeDriver: true,
      }),
    ]);
    animation.current.start();
  }, [delay, distance, duration, initialScale, opacity, reduceMotion, scale, translateY]);

  useEffect(() => {
    if (autoPlay) play();
    return () => animation.current?.stop();
  }, [autoPlay, play]);

  return {
    opacity,
    translateY,
    scale,
    animatedStyle: { opacity, transform: [{ translateY }, { scale }] },
    play,
  };
};
