import { useMemo } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
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
