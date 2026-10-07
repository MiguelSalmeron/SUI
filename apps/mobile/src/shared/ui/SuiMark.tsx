import React, { useMemo } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { SUI_BRAND } from '@/shared/theme/brand';
import { useAppTheme } from '@/shared/theme/theme';

export type SuiMarkVariant = 'isologo' | 'isotype';
export type SuiMarkTone = 'brand' | 'inverse' | 'monochrome';

type Props = {
  variant?: SuiMarkVariant;
  tone?: SuiMarkTone;
  size: number;
  accessible?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ImageStyle>;
};

const SOURCES = {
  isologo: require('../../../assets/brand/sui-isologo.png'),
  isotype: require('../../../assets/brand/sui-isotype.png'),
} as const;

const ASPECT_RATIOS: Record<SuiMarkVariant, number> = {
  isologo: 1024 / 745,
  isotype: 1024 / 622,
};

export const SuiMark = ({
  variant = 'isologo',
  tone = 'brand',
  size,
  accessible = false,
  accessibilityLabel = 'Sui',
  style,
}: Props) => {
  const { colors } = useAppTheme();
  const tintColor = useMemo(() => {
    if (tone === 'inverse') return SUI_BRAND.white;
    if (tone === 'monochrome') return colors.onSurface;
    return SUI_BRAND.blue;
  }, [colors.onSurface, tone]);

  return (
    <Image
      source={SOURCES[variant]}
      resizeMode="contain"
      tintColor={tintColor}
      style={[{ width: size * ASPECT_RATIOS[variant], height: size }, style]}
      accessible={accessible || undefined}
      accessibilityRole={accessible ? 'image' : undefined}
      accessibilityLabel={accessible ? accessibilityLabel : undefined}
    />
  );
};

type SuiAvatarProps = {
  size: number;
  pose?: 'idle' | 'wink';
  layer?: 'all' | 'body' | 'eyes';
};

export const SuiAvatar = React.memo(function SuiAvatar({
  size,
  pose = 'idle',
  layer = 'all',
}: SuiAvatarProps) {
  const { colors } = useAppTheme();
  return (
    <Svg width={size} height={size * (124 / 208)} viewBox="0 0 208 124" accessible={false}>
      {layer !== 'eyes' && (
        <Path
          d="M62 0 H146 C180.2 0 208 27.8 208 62 C208 96.2 180.2 124 146 124 H62 C27.8 124 0 96.2 0 62 C0 27.8 27.8 0 62 0 Z"
          fill={colors.primary}
        />
      )}
      {layer !== 'body' && (
        <G>
          <G transform="translate(86 53) rotate(-4)">
            <Path
              fill={colors.onPrimary}
              d="M-10.5 -11.5 C-10.5 -25.5 10.5 -25.5 10.5 -11.5 V11.5 C10.5 25.5 -10.5 25.5 -10.5 11.5 Z"
            />
          </G>
          <G transform="translate(140 50) rotate(-4)">
            {pose === 'wink' ? (
              <Path
                d="M-11 0 H11"
                fill="none"
                stroke={colors.onPrimary}
                strokeWidth={7}
                strokeLinecap="round"
              />
            ) : (
              <Path
                fill={colors.onPrimary}
                d="M-10.5 -11.5 C-10.5 -25.5 10.5 -25.5 10.5 -11.5 V11.5 C10.5 25.5 -10.5 25.5 -10.5 11.5 Z"
              />
            )}
          </G>
        </G>
      )}
    </Svg>
  );
});
