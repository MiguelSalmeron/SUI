import { translations } from '@/shared/i18n/translations';

describe('accountability copy gate', () => {
  it('no contiene culpa, humillación, insultos ni amenazas', () => {
    const forbidden =
      /\b(fracaso|flojo|inútil|vergüenza|culpa|castigo|amenaza|failure|lazy|worthless|shame|guilt|punish|threat)\b/i;
    for (const locale of Object.values(translations)) {
      for (const [key, copy] of Object.entries(locale)) {
        if (key.startsWith('accountability.')) expect(copy).not.toMatch(forbidden);
      }
    }
  });
});
