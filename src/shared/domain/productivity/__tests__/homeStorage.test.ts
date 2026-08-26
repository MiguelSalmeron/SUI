import {
  advanceStreak,
  applyDailyReset,
  isStreakAlive,
  localDateKey,
  normalizeStreak,
  resetHabitsCompletion,
  yesterdayKey,
} from '../homeStorage';
import type { Goal, Habit } from '@/shared/types/models';

const fixedDate = new Date(2026, 5, 30, 10, 0, 0);

const testGoals: Goal[] = [
  {
    id: 'g1',
    title: 'Proyecto C++',
    deadline: '2026-07-05',
    progress: 20,
    milestones: [],
    impactDays: ['2026-07-05'],
    completed: false,
    gravity: 'high',
    createdAt: '2026-06-30',
  },
];

const testHabits: Habit[] = [
  {
    id: 'h1',
    title: 'Estudiar 30m',
    completed: true,
    frequency: 'daily',
    streak: 3,
    createdAt: '2026-06-30',
  },
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
  });

  it('resetea completados de hábitos solo cuando cambia el día', () => {
    expect(applyDailyReset(testGoals, testHabits, '2026-06-30')).toEqual({
      goals: testGoals,
      habits: testHabits,
      todayKey: '2026-06-30',
      didReset: false,
    });

    const reset = applyDailyReset(testGoals, testHabits, '2026-06-29');
    expect(reset.didReset).toBe(true);
    expect(reset.habits.every((item) => !item.completed)).toBe(true);
  });

  it('resetHabitsCompletion conserva id y title', () => {
    expect(resetHabitsCompletion(testHabits)).toEqual([
      { ...testHabits[0], completed: false },
    ]);
  });
});
