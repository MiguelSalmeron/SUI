import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorScheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { SUI_FONTS } from '@/shared/theme/brand';
import { useCelebrationStore } from '@/shared/domain/productivity/useCelebrationStore';

export const CelebrationToast = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const visible = useCelebrationStore((s) => s.visible);
  const title = useCelebrationStore((s) => s.title);
  const subtitle = useCelebrationStore((s) => s.subtitle);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, title, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + SPACING.sm,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={22} color={colors.flame} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: SPACING.lg,
      right: SPACING.lg,
      zIndex: 200,
      elevation: 7,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.flame,
      borderRadius: 16,
      padding: SPACING.md,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.onFlame,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textCol: {
      flex: 1,
    },
    title: {
      color: colors.onFlame,
      fontSize: 16,
      fontWeight: '400',
      fontFamily: SUI_FONTS.display,
    },
    subtitle: {
      color: colors.onFlame,
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'Poppins-Bold',
      opacity: 0.9,
      marginTop: 2,
    },
  });
