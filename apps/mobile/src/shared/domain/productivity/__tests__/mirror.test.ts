import { shouldMirrorGoal, shouldMirrorHabit } from '../model/mirror';

describe('mirror rules Fase 1', () => {
  it('meta con fecha espeja por defecto', () => {
    expect(shouldMirrorGoal({ deadline: '2026-09-20' })).toBe(true);
  });

  it('meta con opt-out no espeja', () => {
    expect(shouldMirrorGoal({ deadline: '2026-09-20', mirrorToGoogle: false })).toBe(false);
  });

  it('hábito checklist no espeja aunque prefs globales lo permitan', () => {
    expect(
      shouldMirrorHabit(
        { mirrorToGoogle: false },
        { goalsEnabled: true, habitsEnabled: true },
      ),
    ).toBe(false);
  });

  it('hábito con hora y flag espeja', () => {
    expect(
      shouldMirrorHabit(
        { plannedTime: '07:30', mirrorToGoogle: true },
        { goalsEnabled: true, habitsEnabled: true },
      ),
    ).toBe(true);
  });

  it('hábito con hora pero sin flag no espeja', () => {
    expect(
      shouldMirrorHabit(
        { plannedTime: '07:30' },
        { goalsEnabled: true, habitsEnabled: true },
      ),
    ).toBe(false);
  });

  it('hora inválida no espeja', () => {
    expect(
      shouldMirrorHabit(
        { plannedTime: '7:30', mirrorToGoogle: true },
        { goalsEnabled: true, habitsEnabled: true },
      ),
    ).toBe(false);
  });
});
