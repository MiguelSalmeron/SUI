export type FocusTarget =
  | { kind: 'milestone'; goalId: string; milestoneId: string }
  | { kind: 'habit'; habitId: string }
  | { kind: 'goal'; goalId: string };

export type FocusDay = { dayKey: string; sessions: number; minutes: number };
