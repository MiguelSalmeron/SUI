import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { MOTION } from '@/shared/ui/motion/motionTokens';

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

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  const scale = useRef(new Animated.Value(initialScale)).current;

  const play = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        scale.setValue(1);
        return;
      }

      Animated.parallel([
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
      ]).start();
    }).catch(() => {
      Animated.parallel([
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
      ]).start();
    });
  };

  useEffect(() => {
    if (autoPlay) {
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay]);

  return {
    opacity,
    translateY,
    scale,
    animatedStyle: {
      opacity,
      transform: [{ translateY }, { scale }],
    },
    play,
  };
};
