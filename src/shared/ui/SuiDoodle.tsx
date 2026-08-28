import React from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '@/shared/theme/theme';

export type SuiDoodleVariant = 'sprout' | 'path' | 'rhythm' | 'calendar';

type Props = {
  variant: SuiDoodleVariant;
  size?: number;
  color?: string;
};

export const SuiDoodle = ({ variant, size = 88, color }: Props) => {
  const { colors } = useAppTheme();
  const stroke = color ?? colors.primary;
  const common = {
    fill: 'none',
    stroke,
    strokeWidth: 2.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg
      width={size}
      height={size * 0.72}
      viewBox="0 0 120 86"
      {...(Platform.OS === 'web'
        ? { 'aria-hidden': true }
        : { accessible: false, accessibilityElementsHidden: true })}
    >
      {variant === 'sprout' ? (
        <>
          <Path d="M60 72V39" {...common} />
          <Path d="M60 47C45 47 35 38 34 24c14-1 25 7 26 23Z" {...common} />
          <Path d="M61 57c14 0 24-8 26-21-14-2-25 6-26 21Z" {...common} />
          <Path d="M34 74c15-7 38-7 53 0" {...common} />
          <Circle cx="96" cy="24" r="4" fill={stroke} />
        </>
      ) : null}
      {variant === 'path' ? (
        <>
          <Path d="M18 68c10-20 28-10 34-29 5-15 18-24 43-19" {...common} />
          <Circle cx="18" cy="68" r="5" fill={stroke} />
          <Circle cx="97" cy="20" r="5" {...common} />
          <Path d="m88 20 5 5 10-12" {...common} />
        </>
      ) : null}
      {variant === 'rhythm' ? (
        <>
          <Path d="M12 50h20l8-19 13 38 12-48 10 29h33" {...common} />
          <Circle cx="18" cy="24" r="4" fill={stroke} />
          <Circle cx="102" cy="68" r="4" fill={stroke} />
        </>
      ) : null}
      {variant === 'calendar' ? (
        <>
          <Rect x="24" y="17" width="72" height="58" rx="12" {...common} />
          <Line x1="24" y1="36" x2="96" y2="36" {...common} />
          <Line x1="43" y1="11" x2="43" y2="24" {...common} />
          <Line x1="77" y1="11" x2="77" y2="24" {...common} />
          <Circle cx="46" cy="52" r="4" fill={stroke} />
          <Circle cx="61" cy="52" r="4" fill={stroke} />
          <Circle cx="76" cy="52" r="4" fill={stroke} />
          <Circle cx="104" cy="20" r="4" fill={stroke} />
        </>
      ) : null}
    </Svg>
  );
};
