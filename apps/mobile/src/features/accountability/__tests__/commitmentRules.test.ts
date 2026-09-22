import {
  ESCALATION_COOLDOWN_MINUTES,
  MAX_ATTEMPTS_PER_CYCLE,
  commitmentIdFor,
  cycleIdFor,
  interventionStage,
  isEscalationCooldownOver,
  isInQuietHours,
  isRestDay,
  isWindowDue,
  makeCycle,
  minutesOfDay,
  nextOccurrences,
  notificationIdentifierFor,
  toLocalDateKey,
  transitionCycle,
  windowStartAt,
} from '../model/commitmentRules';

const QUIET_NIGHT = { startMinute: 22 * 60, endMinute: 7 * 60 };

describe('reglas puras de accountability', () => {
  it('toLocalDateKey usa componentes locales, no UTC', () => {
    expect(toLocalDateKey(new Date(2026, 8, 8))).toBe('2026-09-08');
    expect(toLocalDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('minutesOfDay convierte HH:MM a minutos', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('19:30')).toBe(1170);
    expect(minutesOfDay('23:59')).toBe(1439);
  });

  it('quiet hours simples y con cruce de medianoche', () => {
    // 22:00 → 07:00 (cruza medianoche)
    expect(isInQuietHours(23 * 60, QUIET_NIGHT)).toBe(true);
    expect(isInQuietHours(3 * 60, QUIET_NIGHT)).toBe(true);
    expect(isInQuietHours(6 * 60 + 59, QUIET_NIGHT)).toBe(true);
    expect(isInQuietHours(7 * 60, QUIET_NIGHT)).toBe(false);
    expect(isInQuietHours(12 * 60, QUIET_NIGHT)).toBe(false);
    expect(isInQuietHours(21 * 60 + 59, QUIET_NIGHT)).toBe(false);
    // 13:00 → 14:00 (no cruza)
    const nap = { startMinute: 13 * 60, endMinute: 14 * 60 };
    expect(isInQuietHours(13 * 60, nap)).toBe(true);
    expect(isInQuietHours(14 * 60, nap)).toBe(false);
    // Degenerado: sin ventana protegida
    expect(isInQuietHours(13 * 60, { startMinute: 600, endMinute: 600 })).toBe(false);
  });

  it('rest days por clave local', () => {
    // 2026-09-06 fue domingo; 2026-09-07 lunes.
    expect(isRestDay('2026-09-06', ['sun'])).toBe(true);
    expect(isRestDay('2026-09-07', ['sun'])).toBe(false);
    expect(isRestDay('2026-09-07', [])).toBe(false);
    expect(isRestDay('fecha-inválida', ['sun'])).toBe(false);
  });

  it('nextOccurrences es determinista y respeta la regla', () => {
    const monday = new Date(2026, 8, 7); // lunes
    const daily = nextOccurrences({ kind: 'daily', time: '19:00' }, monday, 7);
    expect(daily.length).toBe(7);
    expect(daily[0]).toEqual({ localDate: '2026-09-07', time: '19:00' });
    expect(daily[6].localDate).toBe('2026-09-13');

    const mwf = nextOccurrences(
      { kind: 'weekly', days: ['mon', 'wed', 'fri'], time: '07:30' },
      monday,
      7,
    );
    expect(mwf.map((w) => w.localDate)).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
    ]);

    const once = nextOccurrences({ kind: 'once', date: '2026-09-09', time: '10:00' }, monday, 7);
    expect(once.map((w) => w.localDate)).toEqual(['2026-09-09']);

    const past = nextOccurrences({ kind: 'once', date: '2026-09-01', time: '10:00' }, monday, 7);
    expect(past).toEqual([]);

    // Mismo input ⇒ mismo output (determinismo, plan §7.2).
    expect(nextOccurrences({ kind: 'daily', time: '19:00' }, monday, 3)).toEqual(
      nextOccurrences({ kind: 'daily', time: '19:00' }, monday, 3),
    );
  });

  it('isWindowDue y windowStartAt', () => {
    expect(windowStartAt('2026-09-08', '19:00').getHours()).toBe(19);
    expect(isWindowDue('2026-09-08', '19:00', new Date(2026, 8, 8, 18, 59))).toBe(false);
    expect(isWindowDue('2026-09-08', '19:00', new Date(2026, 8, 8, 19, 0))).toBe(true);
    expect(isWindowDue('fecha-mala', '19:00', new Date())).toBe(false);
  });

  describe('transitionCycle', () => {
    it('sigue el camino feliz configured → scheduled → due → completed', () => {
      expect(transitionCycle('configured', { type: 'schedule' })).toMatchObject({
        status: 'scheduled',
        attemptCount: 0,
      });
      expect(transitionCycle('scheduled', { type: 'due' })).toMatchObject({
        status: 'due',
        attemptCount: 1,
      });
      const completed = transitionCycle('due', { type: 'complete', at: 'T1' });
      expect(completed).toMatchObject({
        status: 'completed',
        completedAt: 'T1',
        resolution: 'completed',
      });
      expect(completed?.resolvedAt).toBe('SET_NOW');
    });

    it('permite completar aunque la alerta no se haya abierto', () => {
      // Completar desde la app sin responder la alerta es válido.
      expect(transitionCycle('scheduled', { type: 'complete', at: 'T1' })).toMatchObject({
        status: 'completed',
      });
    });

    it('vencimiento: scheduled/due → overdue sin contar intento', () => {
      // El parche no incluye attemptCount: el vencimiento no es una intervención.
      expect(transitionCycle('due', { type: 'expire' })).toEqual({ status: 'overdue' });
      expect(transitionCycle('scheduled', { type: 'expire' })).toEqual({ status: 'overdue' });
      expect(transitionCycle('completed', { type: 'expire' })).toBeNull();
    });

    it('overdue → unknown: ausencia de datos no es fracaso (ADR-0008 §5)', () => {
      expect(transitionCycle('overdue', { type: 'stale' })).toMatchObject({ status: 'unknown' });
      expect(transitionCycle('due', { type: 'stale' })).toBeNull();
    });

    it('resuelve reprogramar, reducir, pausar y abandonar', () => {
      expect(transitionCycle('overdue', { type: 'reschedule' })).toMatchObject({
        status: 'rescheduled',
        resolution: 'rescheduled',
        resolvedAt: 'SET_NOW',
      });
      expect(transitionCycle('due', { type: 'reduce' })).toMatchObject({
        status: 'reduced',
        resolution: 'reduced',
      });
      expect(transitionCycle('in_progress', { type: 'pause' })).toMatchObject({
        status: 'paused',
        resolution: 'paused',
      });
      expect(transitionCycle('overdue', { type: 'abandon' })).toMatchObject({
        status: 'abandoned',
        resolution: 'abandoned',
      });
    });

    it('rechaza transiciones inválidas desde estados cerrados', () => {
      expect(transitionCycle('completed', { type: 'due' })).toBeNull();
      expect(transitionCycle('paused', { type: 'expire' })).toBeNull();
      expect(transitionCycle('rescheduled', { type: 'complete', at: 'T' })).toBeNull();
      expect(transitionCycle('abandoned', { type: 'pause' })).toBeNull();
      expect(transitionCycle('configured', { type: 'expire' })).toBeNull();
      expect(transitionCycle('scheduled', { type: 'schedule' })).toBeNull();
    });
  });

  it('interventionStage respeta máximo por ciclo y interruptor', () => {
    expect(interventionStage('scheduled', 0, true)).toBe('prepare');
    expect(interventionStage('due', 1, true)).toBe('due');
    expect(interventionStage('acknowledged', 1, true)).toBeNull();
    expect(interventionStage('in_progress', 1, true)).toBeNull();
    expect(interventionStage('overdue', 1, true)).toBe('overdue');
    // Límite alcanzado: degrada a revisión, nunca más presión.
    expect(interventionStage('overdue', MAX_ATTEMPTS_PER_CYCLE, true)).toBe('review');
    // Escalamiento desactivado: directo a revisión.
    expect(interventionStage('overdue', 1, false)).toBe('review');
    expect(interventionStage('unknown', 0, true)).toBe('review');
    expect(interventionStage('completed', 0, true)).toBeNull();
    expect(interventionStage('paused', 0, true)).toBeNull();
  });

  it('cooldown de escalamiento', () => {
    const now = new Date('2026-09-08T12:00:00Z');
    const justNow = new Date(now.getTime() - 30 * 60_000).toISOString();
    const longAgo = new Date(
      now.getTime() - (ESCALATION_COOLDOWN_MINUTES + 1) * 60_000,
    ).toISOString();
    expect(isEscalationCooldownOver(justNow, now)).toBe(false);
    expect(isEscalationCooldownOver(longAgo, now)).toBe(true);
    // Timestamp inválido: no bloquea (falla abierta, la reconciliación decide).
    expect(isEscalationCooldownOver('no-es-fecha', now)).toBe(true);
  });

  it('IDs deterministas por sujeto, ciclo y etapa', () => {
    expect(commitmentIdFor('goal', 'g1')).toBe('acc:goal:g1');
    expect(commitmentIdFor('goal', 'g1')).toBe(commitmentIdFor('goal', 'g1'));
    const commitmentId = commitmentIdFor('habit', 'h1');
    const cycleId = cycleIdFor(commitmentId, '2026-09-08');
    expect(cycleId).toBe('acc:habit:h1:2026-09-08');
    // El cycleId ya incorpora el compromiso: el ID no lo duplica.
    expect(notificationIdentifierFor(cycleId, 'due')).toBe(
      'sui-accountability:acc:habit:h1:2026-09-08:due',
    );
  });

  it('makeCycle crea ciclos con ID determinista y estado inicial', () => {
    const cycle = makeCycle('acc:goal:g1', { localDate: '2026-09-08', time: '19:00' }, 'T0');
    expect(cycle.id).toBe('acc:goal:g1:2026-09-08');
    expect(cycle.commitmentId).toBe('acc:goal:g1');
    expect(cycle.status).toBe('configured');
    expect(cycle.attemptCount).toBe(0);
  });
});
