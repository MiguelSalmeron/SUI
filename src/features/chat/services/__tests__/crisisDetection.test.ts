import { detectCrisis } from '../crisisDetection';
import type { CrisisConfig } from '../crisisConfig';

const crisisConfig: CrisisConfig = {
  version: 1,
  title: 'Ayuda disponible',
  message: 'Estamos aquí para ti.',
  keywords: [
    'suicidio',
    'matarme',
    'quiero morir',
    'no quiero vivir',
    'autolesion',
    'hacerme daño',
  ],
  contacts: [{ label: 'Emergencias', phone: '911' }],
};

describe('detectCrisis', () => {
  it('detecta keywords exactas y frases completas', () => {
    expect(detectCrisis('Estoy pensando en suicidio.', crisisConfig)).toBe(true);
    expect(detectCrisis('Siento que quiero morir', crisisConfig)).toBe(true);
    expect(detectCrisis('No quiero vivir más', crisisConfig)).toBe(true);
  });

  it('normaliza mayúsculas y acentos', () => {
    expect(detectCrisis('Me preocupa la AUTOLESIÓN', crisisConfig)).toBe(true);
    expect(detectCrisis('Siento ganas de hacerme dano', crisisConfig)).toBe(true);
  });

  it('evita falsos positivos por subcadenas dentro de palabras largas', () => {
    expect(detectCrisis('Leí un artículo de suicidiología preventiva', crisisConfig)).toBe(false);
    expect(detectCrisis('Automatarme no es una palabra normal', crisisConfig)).toBe(false);
  });

  it('retorna false sin keywords o con texto no crítico', () => {
    expect(detectCrisis('Hoy tuve un día difícil en la universidad', crisisConfig)).toBe(false);
    expect(detectCrisis('suicidio', { ...crisisConfig, keywords: [] })).toBe(false);
    expect(detectCrisis('', crisisConfig)).toBe(false);
  });
});
