import {
  advanceStreak,
  applyDailyReset,
  isStreakAlive,
  localDateKey,
  normalizeStreak,
  resetItemsCompletion,
  yesterdayKey,
  type HomeListItem,
} from '../homeStorage';

const fixedDate = new Date(2026, 5, 30, 10, 0, 0);

const items: HomeListItem[] = [
  { id: 'a', title: 'Leer', completed: true },
  { id: 'b', title: 'Agua', completed: false },
];

describe('homeStorage date and streak helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(fixedDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('genera claves locales estables para hoy y ayer', () => {
    expect(localDateKey()).toBe('2026-06-30');
    expect(yesterdayKey()).toBe('2026-06-29');
  });

  it('normaliza rachas vivas y rotas', () => {
    expect(isStreakAlive('2026-06-30')).toBe(true);
    expect(isStreakAlive('2026-06-29')).toBe(true);
    expect(isStreakAlive('2026-06-28')).toBe(false);
    expect(normalizeStreak({ streakCount: 4, lastCompletedDate: '2026-06-28' })).toBe(0);
  });

  it('avanza la racha de forma idempotente dentro del día', () => {
    expect(advanceStreak({ streakCount: 2, lastCompletedDate: '2026-06-29' })).toEqual({
      streakCount: 3,
      lastCompletedDate: '2026-06-30',
    });
    expect(advanceStreak({ streakCount: 3, lastCompletedDate: '2026-06-30' })).toEqual({
      streakCount: 3,
      lastCompletedDate: '2026-06-30',
    });
    expect(advanceStreak({ streakCount: 8, lastCompletedDate: '2026-06-20' })).toEqual({
      streakCount: 1,
      lastCompletedDate: '2026-06-30',
    });
  });

  it('resetea completados solo cuando cambia el día', () => {
    expect(applyDailyReset(items, items, '2026-06-30')).toEqual({
      goals: items,
      habits: items,
      todayKey: '2026-06-30',
      didReset: false,
    });

    const reset = applyDailyReset(items, items, '2026-06-29');
    expect(reset.didReset).toBe(true);
    expect(reset.goals.every((item) => !item.completed)).toBe(true);
    expect(reset.habits.every((item) => !item.completed)).toBe(true);
  });

  it('resetItemsCompletion conserva id y title', () => {
    expect(resetItemsCompletion(items)).toEqual([
      { id: 'a', title: 'Leer', completed: false },
      { id: 'b', title: 'Agua', completed: false },
    ]);
  });
});
