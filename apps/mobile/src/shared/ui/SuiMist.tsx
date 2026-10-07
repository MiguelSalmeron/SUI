import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '@/shared/theme/theme';

export const SuiMist = () => {
  const { colors, scheme } = useAppTheme();
  const gradientId = useId().replace(/:/g, '');
  const opacity = scheme === 'dark' ? 0.25 : 0.6;

  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
    >
      <Defs>
        <RadialGradient id={`${gradientId}-flame`} cx="65%" cy="35%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={colors.flameContainer} stopOpacity={opacity} />
          <Stop offset="1" stopColor={colors.flameContainer} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${gradientId}-blue`} cx="35%" cy="65%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={colors.primaryContainer} stopOpacity={opacity} />
          <Stop offset="1" stopColor={colors.primaryContainer} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId}-flame)`} />
      <Rect width="100%" height="100%" fill={`url(#${gradientId}-blue)`} />
    </Svg>
  );
};
