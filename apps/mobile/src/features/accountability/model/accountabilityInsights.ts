import type { AccountabilityDay, FollowUpCycle, FollowUpFact } from './accountabilityTypes';

export type AccountabilityDigest = {
  completed: number;
  overdue: number;
  unknown: number;
  rescheduled: number;
  total: number;
};

export type AccountabilityPatterns = {
  completionSamples: number;
  rescheduledCycles: number;
  preferredCompletionHour: number | null;
  mostRescheduledDay: AccountabilityDay | null;
};

const DAY_ORDER: AccountabilityDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const isDateKey = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const computeAccountabilityDigest = (
  cycles: FollowUpCycle[],
  fromDate: string,
  toDate: string,
): AccountabilityDigest => {
  const result: AccountabilityDigest = {
    completed: 0,
    overdue: 0,
    unknown: 0,
    rescheduled: 0,
    total: 0,
  };
  if (!isDateKey(fromDate) || !isDateKey(toDate) || fromDate > toDate) return result;

  for (const cycle of cycles) {
    if (cycle.localDate < fromDate || cycle.localDate > toDate) continue;
    if (cycle.status === 'completed' || cycle.resolution === 'completed') result.completed += 1;
    else if (cycle.status === 'rescheduled' || cycle.resolution === 'rescheduled') {
      result.rescheduled += 1;
    } else if (cycle.status === 'unknown') result.unknown += 1;
    else if (cycle.status === 'overdue') result.overdue += 1;
  }
  result.total = result.completed + result.overdue + result.unknown + result.rescheduled;
  return result;
};

const mostFrequent = <T extends string | number>(counts: Map<T, number>, order: T[]): T | null => {
  let winner: T | null = null;
  let winnerCount = 0;
  for (const value of order) {
    const count = counts.get(value) ?? 0;
    if (count > winnerCount) {
      winner = value;
      winnerCount = count;
    }
  }
  return winner;
};

const localHour = (timestamp: string | undefined): number | null => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
};

const dayOf = (localDate: string): AccountabilityDay | null => {
  const date = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()] as AccountabilityDay;
};

export const computeAccountabilityPatterns = (
  cycles: FollowUpCycle[],
  facts: FollowUpFact[],
): AccountabilityPatterns => {
  const factsByCycle = new Map<string, FollowUpFact[]>();
  for (const fact of facts) {
    const list = factsByCycle.get(fact.cycleId) ?? [];
    list.push(fact);
    factsByCycle.set(fact.cycleId, list);
  }

  const completedHours = new Map<number, number>();
  const rescheduledDays = new Map<AccountabilityDay, number>();
  let completionSamples = 0;
  let rescheduledCycles = 0;

  for (const cycle of cycles) {
    const cycleFacts = factsByCycle.get(cycle.id) ?? [];
    const completedFact = cycleFacts
      .filter((fact) => fact.kind === 'completed')
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    const completed =
      cycle.status === 'completed' || cycle.resolution === 'completed' || Boolean(completedFact);
    if (completed) {
      const hour = localHour(cycle.completedAt ?? completedFact?.occurredAt);
      if (hour !== null) {
        completedHours.set(hour, (completedHours.get(hour) ?? 0) + 1);
        completionSamples += 1;
      }
    }

    const rescheduled =
      cycle.status === 'rescheduled' ||
      cycle.resolution === 'rescheduled' ||
      cycleFacts.some((fact) => fact.kind === 'rescheduled');
    if (rescheduled) {
      rescheduledCycles += 1;
      const day = dayOf(cycle.localDate);
      if (day) rescheduledDays.set(day, (rescheduledDays.get(day) ?? 0) + 1);
    }
  }

  return {
    completionSamples,
    rescheduledCycles,
    preferredCompletionHour: mostFrequent(
      completedHours,
      Array.from({ length: 24 }, (_, hour) => hour),
    ),
    mostRescheduledDay: mostFrequent(rescheduledDays, DAY_ORDER),
  };
};
