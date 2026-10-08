import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/shared/theme/theme';
import { SuiAvatar, type PresencePose } from './SuiMark';
import { MOTION } from './motion/motionTokens';
import { useReduceMotion } from './motion/useReduceMotion';

type Props = {
  winkSignal?: number;
  pose?: PresencePose;
  speakSignal?: number;
  size?: number;
  enabled?: boolean;
  active?: boolean;
};

export const SuiAnimatedMark = React.memo(function SuiAnimatedMark({
  winkSignal = 0,
  pose: controlledPose = 'idle',
  speakSignal = 0,
  size = 58,
  enabled = true,
  active = true,
}: Props) {
  const { colors } = useAppTheme();
  const reduceMotion = useReduceMotion();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [gesturePose, setPose] = useState<'idle' | 'wink'>('idle');
  const pose = controlledPose === 'idle' ? gesturePose : controlledPose;
  const breathe = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const gazeX = useRef(new Animated.Value(0)).current;
  const gazeY = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const lastWinkSignal = useRef(winkSignal);
  const lastSpeakSignal = useRef(speakSignal);
  const lastGesturePose = useRef(controlledPose);
  const animate = enabled && reduceMotion === false && foreground;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const idleActive =
    animate && active && (controlledPose === 'idle' || controlledPose === 'listen');

  useEffect(() => {
    if (!idleActive) return;
    const timing = (toValue: number) =>
      Animated.timing(breathe, {
        toValue,
        duration: (controlledPose === 'listen' ? 1200 : MOTION.durations.breathe) / 2,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    const loop = Animated.loop(Animated.sequence([timing(1), timing(0)]));
    loop.start();
    return () => {
      loop.stop();
      breathe.setValue(0);
    };
  }, [idleActive, controlledPose, breathe]);

  const autonomousActive = animate && active && ['idle', 'listen', 'speak'].includes(pose);

  useEffect(() => {
    if (!autonomousActive) return;
    let live = true;
    let gazeTimer: ReturnType<typeof setTimeout> | undefined;
    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    let gazeAnimation: Animated.CompositeAnimation | undefined;
    let blinkAnimation: Animated.CompositeAnimation | undefined;
    let nextGaze = 1;
    const targets = [
      [0, 0],
      [-2, 0],
      [0, 0],
      [2, 0],
      [0, -1],
      [0, 0],
    ];
    const jitter = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    const scheduleGaze = () => {
      gazeTimer = setTimeout(
        () => {
          if (!live) return;
          const [x, y] = targets[nextGaze];
          nextGaze = nextGaze === targets.length - 1 ? 1 : nextGaze + 1;
          const duration = jitter(250, 450);
          gazeAnimation = Animated.parallel([
            timing(gazeX, x, duration),
            timing(gazeY, y, duration),
          ]);
          gazeAnimation.start(({ finished }) => {
            if (live && finished) scheduleGaze();
          });
        },
        jitter(1000, 2500),
      );
    };
    const scheduleBlink = () => {
      blinkTimer = setTimeout(
        () => {
          if (!live) return;
          blinkAnimation = Animated.sequence([timing(blink, 0.08, 70), timing(blink, 1, 100)]);
          blinkAnimation.start(({ finished }) => {
            if (live && finished) scheduleBlink();
          });
        },
        jitter(4000, 7000),
      );
    };
    scheduleGaze();
    scheduleBlink();
    return () => {
      live = false;
      clearTimeout(gazeTimer);
      clearTimeout(blinkTimer);
      gazeAnimation?.stop();
      blinkAnimation?.stop();
      gazeX.setValue(0);
      gazeY.setValue(0);
      blink.setValue(1);
    };
  }, [autonomousActive, gazeX, gazeY, blink]);

  useEffect(() => {
    if (!animate || !active || controlledPose !== 'read') return;
    const timing = (toValue: number) =>
      Animated.timing(gazeX, {
        toValue,
        duration: MOTION.durations.smooth,
        easing: MOTION.easings.gentle,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    const scan = Animated.sequence([timing(-2), timing(2), timing(0)]);
    scan.start();
    return () => {
      scan.stop();
      gazeX.setValue(0);
    };
  }, [animate, active, controlledPose, gazeX]);

  useEffect(() => {
    const changed = lastWinkSignal.current !== winkSignal;
    lastWinkSignal.current = winkSignal;
    if (!animate || controlledPose !== 'idle' || !changed) {
      setPose('idle');
      return;
    }
    let live = true;
    setPose('wink');
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: MOTION.easings.decelerate,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    const flash = Animated.parallel([
      Animated.sequence([timing(squash, 1, 120), timing(squash, 0, 180)]),
      Animated.sequence([timing(pulse, 1, 120), timing(pulse, 0, 480)]),
    ]);
    flash.start(({ finished }) => {
      if (live && finished) setPose('idle');
    });
    return () => {
      live = false;
      flash.stop();
      squash.setValue(0);
      pulse.setValue(0);
    };
  }, [animate, controlledPose, winkSignal, squash, pulse]);

  useEffect(() => {
    const changed = lastSpeakSignal.current !== speakSignal;
    lastSpeakSignal.current = speakSignal;
    const enteredWarm = lastGesturePose.current !== 'warm' && controlledPose === 'warm';
    lastGesturePose.current = controlledPose;
    if (!animate || !active) return;
    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      });
    let gesture: Animated.CompositeAnimation;
    if (controlledPose === 'speak' && changed) {
      gesture = Animated.sequence([
        timing(squash, 0.6, 60),
        Animated.spring(squash, {
          toValue: 0,
          ...MOTION.springs.bounce,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ]);
    } else if (enteredWarm) {
      squash.setValue(0.4);
      pulse.setValue(1);
      gesture = Animated.parallel([
        Animated.spring(squash, {
          toValue: 0,
          ...MOTION.springs.settle,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        timing(pulse, 0, MOTION.durations.gentle),
      ]);
    } else {
      return;
    }
    gesture.start();
    return () => {
      gesture.stop();
      squash.setValue(0);
      pulse.setValue(0);
    };
  }, [animate, active, controlledPose, speakSignal, squash, pulse]);

  const poseOffset = controlledPose === 'listen' ? -1 : controlledPose === 'concern' ? 1 : 0;
  const haloOpacity =
    controlledPose === 'think' || controlledPose === 'read' || controlledPose === 'concern'
      ? 0
      : controlledPose === 'speak'
        ? 0.2
        : controlledPose === 'listen'
          ? 0.18
          : 0.14;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size }]}
    >
      {animate ? (
        <>
          <Animated.View
            pointerEvents="none"
            testID="sui-animated-halo"
            style={[
              styles.halo,
              {
                width: size * (64 / 58),
                height: size * (42 / 58),
                top: size * (8 / 58),
                left: size * (-3 / 58),
              },
              {
                backgroundColor: colors.primaryContainer,
                opacity: Animated.add(
                  breathe.interpolate({
                    inputRange: [0, 1],
                    outputRange: [haloOpacity, haloOpacity + 0.06],
                  }),
                  pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
                ),
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={{
              transform: [
                { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
                {
                  translateY: Animated.add(
                    breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }),
                    poseOffset,
                  ),
                },
              ],
            }}
          >
            <Animated.View
              pointerEvents="none"
              style={{
                transform: [
                  { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                  { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
                ],
              }}
            >
              <View style={{ width: size, height: size * (124 / 208) }}>
                <SuiAvatar size={size} layer="body" />
                <Animated.View
                  pointerEvents="none"
                  testID="sui-gaze"
                  style={[
                    styles.eyes,
                    { transform: [{ translateX: gazeX }, { translateY: gazeY }] },
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    testID="sui-blink"
                    style={{ transform: [{ scaleY: blink }] }}
                  >
                    <SuiAvatar size={size} pose={pose} layer="eyes" />
                  </Animated.View>
                </Animated.View>
              </View>
            </Animated.View>
          </Animated.View>
        </>
      ) : (
        <View style={{ transform: [{ translateY: poseOffset }] }}>
          <SuiAvatar size={size} pose={controlledPose} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  box: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  eyes: { position: 'absolute', top: 0, left: 0 },
  halo: { position: 'absolute', width: 64, height: 42, top: 8, left: -3, borderRadius: 21 },
});
