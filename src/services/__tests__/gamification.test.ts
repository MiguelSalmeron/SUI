import {
  buildWeeklyView,
  calculateLevel,
  computeTotalXp,
  getAchievements,
  getCompletionRate,
  makeSnapshot,
  snapshotXp,
  upsertSnapshot,
  type DailySnapshot,
} from '../gamification';

const sample: DailySnapshot = {
  date: '2026-06-30',
  goalsCompleted: 2,
  goalsTotal: 3,
  habitsCompleted: 1,
  habitsTotal: 2,
  pomodoroSessions: 2,
  pomodoroMinutes: 50,
};

describe('gamification', () => {
  it('calcula XP por snapshot', () => {
    expect(snapshotXp(sample)).toBe(2 * 10 + 1 * 5 + 2 * 25);
  });

  it('calcula nivel a partir de XP', () => {
    const level = calculateLevel(0);
    expect(level.level).toBe(1);
    expect(level.title).toBe('Novato');

    const mid = calculateLevel(150);
    expect(mid.level).toBeGreaterThan(1);
    expect(mid.progress).toBeGreaterThan(0);
    expect(mid.progress).toBeLessThanOrEqual(1);
  });

  it('upsertSnapshot reemplaza el día existente', () => {
    const history: DailySnapshot[] = [
      { ...sample, goalsCompleted: 0 },
    ];
    const updated = upsertSnapshot(history, sample);
    expect(updated).toHaveLength(1);
    expect(updated[0].goalsCompleted).toBe(2);
  });

  it('upsertSnapshot es idempotente si el snapshot no cambió', () => {
    const history: DailySnapshot[] = [sample];
    const updated = upsertSnapshot(history, sample);
    expect(updated).toBe(history);
  });

  it('buildWeeklyView rellena 7 días', () => {
    const week = buildWeeklyView([sample], 7, new Date(2026, 5, 30));
    expect(week).toHaveLength(7);
    expect(week[6].date).toBe('2026-06-30');
  });

  it('getCompletionRate maneja vacío y parcial', () => {
    expect(getCompletionRate({ ...sample, goalsTotal: 0, habitsTotal: 0 })).toBe(0);
    expect(getCompletionRate(sample)).toBe(60);
  });

  it('getAchievements desbloquea primer logro', () => {
    const achievements = getAchievements({
      goalsCompleted: 1,
      goalsTotal: 2,
      habitsCompleted: 0,
      habitsTotal: 0,
      streak: 0,
      pomodoroSessions: 0,
      weeklyHistory: [],
    });
    expect(achievements.find((a) => a.id === 'first_goal')?.unlocked).toBe(true);
  });

  it('computeTotalXp suma historial', () => {
    const xp = computeTotalXp([sample, { ...sample, date: '2026-06-29' }]);
    expect(xp).toBe(snapshotXp(sample) * 2);
  });

  it('makeSnapshot refleja estado actual', () => {
    const snap = makeSnapshot(
      [{ completed: true }, { completed: false }],
      [{ completed: true }],
      3,
      75,
      '2026-06-30',
    );
    expect(snap.goalsCompleted).toBe(1);
    expect(snap.habitsCompleted).toBe(1);
    expect(snap.pomodoroSessions).toBe(3);
  });
});
