import { isHabitDueToday, localDateKey } from '@/shared/domain/productivity/pure';
import type { FocusTarget } from '@/shared/focus/focusTypes';
import type { TranslationKey } from '@/shared/i18n/translations';
import type { Goal, Habit } from '@/shared/types/models';

export type Energy = 'low' | 'normal' | 'high';
export type AvailableTime = 30 | 60 | 120 | null;

export type PlanStep = {
  id: string;
  target: FocusTarget;
  title: string;
  parentTitle?: string;
  reasonKey: TranslationKey;
  reasonParams?: Record<string, string | number>;
  blockMinutes: 15 | 25 | 50;
};

type Candidate = {
  step: PlanStep;
  score: number;
  deadline: number;
  plannedTime: number;
};

const compare = (a: string | number, b: string | number): number => (a < b ? -1 : a > b ? 1 : 0);

const dayNumber = (key: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return Infinity;
  const date = new Date(`${key}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== key) {
    return Infinity;
  }
  return date.getTime() / 86_400_000;
};

const timeMinutes = (time: string | undefined): number => {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return Infinity;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function buildDayPlan(input: {
  goals: Goal[];
  habits: Habit[];
  energy: Energy;
  availableTime: AvailableTime;
  now: Date;
}): PlanStep[] {
  const { goals, habits, energy, availableTime, now } = input;
  if (!Number.isFinite(now.getTime())) return [];
  const today = dayNumber(localDateKey(now));
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const blockMinutes = energy === 'low' ? 15 : energy === 'high' ? 50 : 25;
  const candidates: Candidate[] = [];

  for (const goal of goals) {
    if (goal.completed) continue;
    const milestone = goal.milestones.find((item) => !item.completed);
    if (goal.milestones.length > 0 && !milestone) continue;
    const deadline = dayNumber(goal.deadline);
    const days = deadline - today;
    const important = goal.gravity === 'high';
    let score = days < 0 ? 100 : days === 0 ? 90 : days <= 2 ? 70 : days <= 7 ? 40 : 10;
    if (important) score += 30 + (energy === 'low' ? -10 : energy === 'high' ? 25 : 0);
    const reasonKey: TranslationKey =
      days < 0
        ? 'home.plan.reason.overdue'
        : days === 0
          ? 'home.plan.reason.dueToday'
          : days === 1
            ? 'home.plan.reason.dueTomorrow'
            : days <= 7
              ? 'home.plan.reason.dueSoon'
              : important
                ? 'home.plan.reason.important'
                : milestone
                  ? 'home.plan.reason.advanceGoal'
                  : 'home.plan.reason.firstStep';
    candidates.push({
      score,
      deadline,
      plannedTime: Infinity,
      step: {
        id: milestone ? `milestone:${goal.id}:${milestone.id}` : `goal:${goal.id}`,
        target: milestone
          ? { kind: 'milestone', goalId: goal.id, milestoneId: milestone.id }
          : { kind: 'goal', goalId: goal.id },
        title: milestone?.title ?? goal.title,
        ...(milestone ? { parentTitle: goal.title } : {}),
        reasonKey,
        ...(days >= 2 && days <= 7 ? { reasonParams: { days } } : {}),
        blockMinutes,
      },
    });
  }

  for (const habit of habits) {
    if (habit.completed || !isHabitDueToday(habit, now)) continue;
    const plannedTime = timeMinutes(habit.plannedTime);
    const delta = plannedTime - currentMinute;
    let score = delta < 0 ? 50 : delta <= 120 ? 60 : 45;
    score += energy === 'low' ? 25 : energy === 'high' ? -10 : 0;
    const hasTime = Number.isFinite(plannedTime);
    candidates.push({
      score,
      deadline: Infinity,
      plannedTime,
      step: {
        id: `habit:${habit.id}`,
        target: { kind: 'habit', habitId: habit.id },
        title: habit.title,
        reasonKey: hasTime ? 'home.plan.reason.habitAt' : 'home.plan.reason.habitToday',
        ...(hasTime ? { reasonParams: { time: habit.plannedTime! } } : {}),
        blockMinutes,
      },
    });
  }

  candidates.sort(
    (a, b) =>
      compare(b.score, a.score) ||
      compare(a.deadline, b.deadline) ||
      compare(a.plannedTime, b.plannedTime) ||
      compare(a.step.title, b.step.title) ||
      compare(a.step.id, b.step.id),
  );
  const count =
    availableTime === null ? 3 : Math.min(3, Math.max(1, Math.floor(availableTime / blockMinutes)));
  return candidates.slice(0, count).map(({ step }) => step);
}
