import { SUI_FONTS } from './brand';
import type { FontSize } from '@/shared/preferences/useSettingsStore';

export type TypeStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  fontFamily: string;
  letterSpacing?: number;
};

export const TYPOGRAPHY = {
  brandDisplayLg: { fontSize: 42, lineHeight: 50, fontWeight: '400', fontFamily: SUI_FONTS.display },
  brandDisplayMd: { fontSize: 32, lineHeight: 40, fontWeight: '400', fontFamily: SUI_FONTS.display },
  brandDisplaySm: { fontSize: 24, lineHeight: 32, fontWeight: '400', fontFamily: SUI_FONTS.display },
  brandTitle: { fontSize: 18, lineHeight: 24, fontWeight: '400', fontFamily: SUI_FONTS.display },
  brandLabel: { fontSize: 13, lineHeight: 18, fontWeight: '400', fontFamily: SUI_FONTS.display },

  displayLg: { fontSize: 52, lineHeight: 60, fontWeight: '700', fontFamily: SUI_FONTS.bold },
  displayMd: { fontSize: 40, lineHeight: 48, fontWeight: '700', fontFamily: SUI_FONTS.bold },
  displaySm: { fontSize: 32, lineHeight: 40, fontWeight: '700', fontFamily: SUI_FONTS.bold },

  headlineLg: { fontSize: 30, lineHeight: 38, fontWeight: '700', fontFamily: SUI_FONTS.bold },
  headlineMd: { fontSize: 26, lineHeight: 34, fontWeight: '700', fontFamily: SUI_FONTS.bold },
  headlineSm: { fontSize: 22, lineHeight: 30, fontWeight: '700', fontFamily: SUI_FONTS.bold },

  titleLg: { fontSize: 20, lineHeight: 28, fontWeight: '700', fontFamily: SUI_FONTS.bold },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.1 },
  titleSm: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.1 },

  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400', fontFamily: SUI_FONTS.regular },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400', fontFamily: SUI_FONTS.regular },
  bodySm: { fontSize: 12, lineHeight: 16, fontWeight: '400', fontFamily: SUI_FONTS.regular },

  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.1 },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.5 },
  labelSm: { fontSize: 11, lineHeight: 16, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.5 },
  labelXs: { fontSize: 10, lineHeight: 14, fontWeight: '600', fontFamily: SUI_FONTS.semibold, letterSpacing: 0.4 },
} satisfies Record<string, TypeStyle>;

export const MD3_TYPE = TYPOGRAPHY;

export type TypographyToken = keyof typeof TYPOGRAPHY;
export type TypographyScale = Record<TypographyToken, TypeStyle>;

export const FONT_SCALE_MAP: Record<FontSize, number> = {
  small: 0.88,
  medium: 1,
  large: 1.15,
};

export const scaleTypography = <T extends Record<string, TypeStyle>>(
  typeTokens: T,
  scale: number,
): T => {
  if (scale === 1) return typeTokens;

  const result = {} as T;
  for (const key of Object.keys(typeTokens) as Array<keyof T>) {
    const style = typeTokens[key];
    result[key] = {
      ...style,
      fontSize: Math.round(style.fontSize * scale),
      lineHeight: Math.round(style.lineHeight * scale),
    };
  }
  return result;
};
