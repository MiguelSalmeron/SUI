import { SUI_FONTS } from '../brand';
import {
  FONT_SCALE_MAP,
  MD3_TYPE,
  TYPOGRAPHY,
  scaleTypography,
} from '../typography';

describe('sistema tipográfico Sui', () => {
  it('expone escala semántica completa', () => {
    expect(Object.keys(TYPOGRAPHY)).toEqual([
      'brandDisplayLg',
      'brandDisplayMd',
      'brandDisplaySm',
      'brandTitle',
      'brandLabel',
      'displayLg',
      'displayMd',
      'displaySm',
      'headlineLg',
      'headlineMd',
      'headlineSm',
      'titleLg',
      'titleMd',
      'titleSm',
      'bodyLg',
      'bodyMd',
      'bodySm',
      'labelLg',
      'labelMd',
      'labelSm',
      'labelXs',
    ]);
    expect(TYPOGRAPHY.displayLg).toMatchObject({ fontSize: 52, lineHeight: 60 });
    expect(TYPOGRAPHY.headlineSm).toMatchObject({ fontSize: 22, lineHeight: 30 });
    expect(TYPOGRAPHY.bodyMd).toMatchObject({ fontSize: 14, lineHeight: 20 });
    expect(TYPOGRAPHY.labelXs).toMatchObject({ fontSize: 10, lineHeight: 14 });
  });

  it('usa sólo familias y pesos disponibles', () => {
    const allowedWeights = new Set(['400', '500', '600', '700']);
    const allowedFamilies = new Set(Object.values(SUI_FONTS));

    for (const style of Object.values(TYPOGRAPHY)) {
      expect(allowedWeights.has(style.fontWeight)).toBe(true);
      expect(allowedFamilies.has(style.fontFamily)).toBe(true);
    }
  });

  it('reserva Fredoka para tokens expresivos', () => {
    for (const [name, style] of Object.entries(TYPOGRAPHY)) {
      expect(style.fontFamily === SUI_FONTS.display).toBe(name.startsWith('brand'));
    }
  });

  it('conserva alias MD3 y mapa de preferencias', () => {
    expect(MD3_TYPE).toBe(TYPOGRAPHY);
    expect(FONT_SCALE_MAP).toEqual({ small: 0.88, medium: 1, large: 1.15 });
  });

  it.each([
    ['small', 0.88],
    ['medium', 1],
    ['large', 1.15],
  ] as const)('escala %s sin alterar familia, peso ni espaciado', (_name, scale) => {
    const scaled = scaleTypography(TYPOGRAPHY, scale);

    for (const token of Object.keys(TYPOGRAPHY) as Array<keyof typeof TYPOGRAPHY>) {
      const original = TYPOGRAPHY[token];
      expect(scaled[token]).toEqual({
        ...original,
        fontSize: Math.round(original.fontSize * scale),
        lineHeight: Math.round(original.lineHeight * scale),
      });
    }
  });
});
