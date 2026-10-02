import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import { MOTION } from '@/shared/ui/motion/motionTokens';
import { useReduceMotion } from '@/shared/ui/motion/useReduceMotion';
import { useOrganicEntrance } from '../hooks/useOrganicEntrance';

export const OnboardingEntrance = ({
  children,
  delay = 0,
  duration,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
}) => {
  const { animatedStyle } = useOrganicEntrance({ delay, duration });
  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

export const OnboardingButton = ({
  children,
  attention = false,
  ...props
}: TouchableOpacityProps & { attention?: boolean }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const reduceMotion = useReduceMotion();
  useEffect(() => () => scale.stopAnimation(), [scale]);
  useEffect(() => {
    pulse.setValue(1);
    if (!attention || props.disabled || pressed || reduceMotion !== false) return;
    const beat = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: MOTION.durations.gentle,
        easing: MOTION.easings.gentle,
        useNativeDriver: true,
      });
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(2800),
        beat(1.016),
        beat(1),
        Animated.delay(160),
        beat(1.01),
        beat(1),
      ]),
    );
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') {
      animation.start();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      animation.stop();
      pulse.setValue(1);
      if (state === 'active') animation.start();
    });
    return () => {
      animation.stop();
      subscription.remove();
      pulse.setValue(1);
    };
  }, [attention, pressed, props.disabled, pulse, reduceMotion]);
  const press = (toValue: number) => {
    scale.stopAnimation();
    if (reduceMotion !== false) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration: 150,
      easing: MOTION.easings.standard,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, pulse) }] }}>
      <TouchableOpacity
        {...props}
        activeOpacity={0.8}
        onPressIn={(event) => {
          setPressed(true);
          press(0.97);
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          setPressed(false);
          press(1);
          props.onPressOut?.(event);
        }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};
