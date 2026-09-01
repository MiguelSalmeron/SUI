import { SUI_BRAND, SUI_FONTS } from '../brand';

const luminance = (hex: string) => {
  const channels = hex
    .match(/[\da-f]{2}/gi)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (foreground: string, background: string) => {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

describe('identidad visual Sui', () => {
  it('conserva colores institucionales', () => {
    expect(SUI_BRAND).toEqual({
      blue: '#218ECE',
      navy: '#0B132B',
      white: '#FFFFFF',
      actionBlue: '#1677A6',
      sage: '#55796F',
      flame: '#E87536',
    });
  });

  it('mantiene contraste AA en combinaciones operativas', () => {
    expect(contrast(SUI_BRAND.actionBlue, SUI_BRAND.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SUI_BRAND.sage, SUI_BRAND.white)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SUI_BRAND.blue, SUI_BRAND.navy)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(SUI_BRAND.flame, SUI_BRAND.navy)).toBeGreaterThanOrEqual(4.5);
  });

  it('reserva azul institucional con blanco para texto grande o marca', () => {
    expect(contrast(SUI_BRAND.blue, SUI_BRAND.white)).toBeGreaterThanOrEqual(3);
    expect(contrast(SUI_BRAND.blue, SUI_BRAND.white)).toBeLessThan(4.5);
  });

  it('expone familias locales de interfaz y expresión', () => {
    expect(SUI_FONTS).toEqual({
      regular: 'Poppins-Regular',
      medium: 'Poppins-Medium',
      semibold: 'Poppins-SemiBold',
      bold: 'Poppins-Bold',
      display: 'FredokaOne-Regular',
    });
  });
});
