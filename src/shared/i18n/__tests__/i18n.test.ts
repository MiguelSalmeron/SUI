jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

import { translate } from '../i18n';
import { translations } from '../translations';

describe('i18n', () => {
  it('mantiene las mismas claves en ES y EN', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.es).sort());
  });

  it('interpola valores sin perder idioma', () => {
    expect(translate('es', 'home.completedCount', { done: 1, total: 3 })).toBe('1 de 3 completadas');
    expect(translate('en', 'home.completedCount', { done: 1, total: 3 })).toBe('1 of 3 completed');
  });
});
