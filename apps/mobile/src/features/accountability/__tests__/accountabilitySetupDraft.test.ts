jest.mock('@/shared/ui/Ionicons', () => ({ Ionicons: () => null }));

import { buildSetupDraft } from '../components/AccountabilitySetupSheet';

const base = () => ({
  nextAction: 'Ordenar imágenes del portafolio',
  minimumAction: '',
  durationMinutes: '',
  time: '19:00',
  intensity: 'firm' as const,
  escalation: 'reschedule_or_minimum' as const,
  frequency: 'daily' as const,
  days: ['mon', 'wed'] as string[],
});

describe('buildSetupDraft', () => {
  it('construye agenda diaria válida', () => {
    const result = buildSetupDraft(base());
    expect('draft' in result && result.draft).toMatchObject({
      nextAction: 'Ordenar imágenes del portafolio',
      schedule: { kind: 'daily', time: '19:00' },
      intensity: 'firm',
    });
    expect('draft' in result && 'minimumAction' in result.draft).toBe(false);
  });

  it('construye agenda semanal con días normalizados', () => {
    const result = buildSetupDraft({ ...base(), frequency: 'weekly', days: ['mon', 'wed', 'fri'] });
    expect('draft' in result && result.draft.schedule).toEqual({
      kind: 'weekly',
      days: ['mon', 'wed', 'fri'],
      time: '19:00',
    });
  });

  it('rechaza acción vacía o demasiado larga', () => {
    expect(buildSetupDraft({ ...base(), nextAction: '   ' })).toEqual({
      errorKey: 'accountability.setup.errorAction',
    });
    expect(
      buildSetupDraft({ ...base(), nextAction: 'x'.repeat(121) }),
    ).toEqual({ errorKey: 'accountability.setup.errorAction' });
  });

  it('rechaza hora inválida', () => {
    expect(buildSetupDraft({ ...base(), time: '25:99' })).toEqual({
      errorKey: 'accountability.setup.errorTime',
    });
    expect(buildSetupDraft({ ...base(), time: '7pm' })).toEqual({
      errorKey: 'accountability.setup.errorTime',
    });
  });

  it('rechaza semanal sin días', () => {
    expect(buildSetupDraft({ ...base(), frequency: 'weekly', days: [] })).toEqual({
      errorKey: 'accountability.setup.errorDays',
    });
  });

  it('incluye versión mínima y duración sólo si son válidas', () => {
    const withExtras = buildSetupDraft({
      ...base(),
      minimumAction: 'Ordenar 5 imágenes',
      durationMinutes: '20',
    });
    expect('draft' in withExtras).toBe(true);
    expect('draft' in withExtras && withExtras.draft.minimumAction).toBe('Ordenar 5 imágenes');
    expect('draft' in withExtras && withExtras.draft.durationMinutes).toBe(20);

    const garbage = buildSetupDraft({ ...base(), durationMinutes: '9999' });
    expect('draft' in garbage && garbage.draft.durationMinutes).toBeUndefined();

    const emptyMin = buildSetupDraft({ ...base(), minimumAction: '  ' });
    expect('draft' in emptyMin && 'minimumAction' in emptyMin.draft).toBe(false);
  });
});
