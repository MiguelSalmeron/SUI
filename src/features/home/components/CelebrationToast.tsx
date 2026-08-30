import { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@/shared/ui/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, SPACING, useAppTheme } from '@/shared/theme/theme';
import { useCelebrationStore } from '@/shared/domain/productivity/public';
import { useI18n } from '@/shared/i18n/i18n';

export const CelebrationToast = () => {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const visible = useCelebrationStore((s) => s.visible);
  const kind = useCelebrationStore((s) => s.kind);
  const subtitle = useCelebrationStore((s) => s.subtitle);
  const { t } = useI18n();
  const title =
    kind === 'goal'
      ? t('celebration.goal')
      : kind === 'habit'
        ? t('celebration.habit')
        : t('celebration.perfectDay');
  const visibleSubtitle = subtitle || t('celebration.consistency');
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    translateY.setValue(-120);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        speed: 18,
        bounciness: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: Platform.OS !== 'web',
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
          <Text style={styles.subtitle}>{visibleSubtitle}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = ({ colors, type }: AppTheme) =>
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
      ...type.brandTitle,
      color: colors.onFlame,
    },
    subtitle: {
      ...type.labelMd,
      color: colors.onFlame,
      opacity: 0.9,
      marginTop: 2,
    },
  });
