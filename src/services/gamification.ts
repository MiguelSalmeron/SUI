import { localDateKey } from './homeStorage';

export interface DailySnapshot {
  date: string;
  goalsCompleted: number;
  goalsTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  pomodoroSessions: number;
  pomodoroMinutes: number;
}

export type AchievementId =
  | 'first_goal'
  | 'streak_3'
  | 'streak_7'
  | 'perfect_day'
  | 'pomodoro_5'
  | 'week_active';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export const XP_GOAL = 10;
export const XP_HABIT = 5;
export const XP_POMODORO = 25;

export const snapshotXp = (s: DailySnapshot): number =>
  s.goalsCompleted * XP_GOAL +
  s.habitsCompleted * XP_HABIT +
  s.pomodoroSessions * XP_POMODORO;

export const computeTotalXp = (history: DailySnapshot[]): number =>
  history.reduce((sum, s) => sum + snapshotXp(s), 0);

export interface LevelInfo {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  progress: number;
  title: string;
}

const LEVEL_TITLES = [
  'Novato',
  'Aprendiz',
  'Constante',
  'Enfocado',
  'Disciplinado',
  'Maestro',
  'Leyenda',
];

export const calculateLevel = (xp: number): LevelInfo => {
  let level = 1;
  let threshold = 0;
  let nextThreshold = 100;

  while (xp >= nextThreshold) {
    level++;
    threshold = nextThreshold;
    nextThreshold = threshold + level * 100;
  }

  const currentXp = xp - threshold;
  const nextLevelXp = nextThreshold - threshold;
  const progress = nextLevelXp === 0 ? 1 : currentXp / nextLevelXp;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];

  return { level, currentXp, nextLevelXp, progress, title };
};

export const getCompletionRate = (s: DailySnapshot): number => {
  const total = s.goalsTotal + s.habitsTotal;
  if (total === 0) return 0;
  return Math.round(((s.goalsCompleted + s.habitsCompleted) / total) * 100);
};

export const snapshotsEqual = (a: DailySnapshot, b: DailySnapshot): boolean =>
  a.date === b.date &&
  a.goalsCompleted === b.goalsCompleted &&
  a.goalsTotal === b.goalsTotal &&
  a.habitsCompleted === b.habitsCompleted &&
  a.habitsTotal === b.habitsTotal &&
  a.pomodoroSessions === b.pomodoroSessions &&
  a.pomodoroMinutes === b.pomodoroMinutes;

export const upsertSnapshot = (
  history: DailySnapshot[],
  snapshot: DailySnapshot,
  maxDays = 14,
): DailySnapshot[] => {
  const existing = history.find((s) => s.date === snapshot.date);
  if (existing && snapshotsEqual(existing, snapshot)) {
    return history;
  }
  const filtered = history.filter((s) => s.date !== snapshot.date);
  return [...filtered, snapshot]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-maxDays);
};

export const buildWeeklyView = (
  history: DailySnapshot[],
  days = 7,
  refDate: Date = new Date(),
): DailySnapshot[] => {
  const result: DailySnapshot[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const existing = history.find((s) => s.date === key);
    result.push(
      existing ?? {
        date: key,
        goalsCompleted: 0,
        goalsTotal: 0,
        habitsCompleted: 0,
        habitsTotal: 0,
        pomodoroSessions: 0,
        pomodoroMinutes: 0,
      },
    );
  }
  return result;
};

export const makeSnapshot = (
  goals: { completed: boolean }[],
  habits: { completed: boolean }[],
  pomodoroSessions: number,
  pomodoroMinutes: number,
  date?: string,
): DailySnapshot => ({
  date: date ?? localDateKey(),
  goalsCompleted: goals.filter((g) => g.completed).length,
  goalsTotal: goals.length,
  habitsCompleted: habits.filter((h) => h.completed).length,
  habitsTotal: habits.length,
  pomodoroSessions,
  pomodoroMinutes,
});

export interface AchievementContext {
  goalsCompleted: number;
  goalsTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  streak: number;
  pomodoroSessions: number;
  weeklyHistory: DailySnapshot[];
}

export const getAchievements = (ctx: AchievementContext): Achievement[] => {
  const allHistory = ctx.weeklyHistory;
  const totalGoalsEver = allHistory.reduce((s, d) => s + d.goalsCompleted, 0) + ctx.goalsCompleted;
  const activeDays = allHistory.filter(
    (d) => d.goalsCompleted + d.habitsCompleted > 0 || d.pomodoroSessions > 0,
  ).length;
  const todayActive =
    ctx.goalsCompleted + ctx.habitsCompleted > 0 || ctx.pomodoroSessions > 0;
  const activeDaysCount = activeDays + (todayActive ? 1 : 0);

  const total = ctx.goalsTotal + ctx.habitsTotal;
  const completed = ctx.goalsCompleted + ctx.habitsCompleted;
  const perfectDay = total > 0 && completed === total;

  const maxPomodoros = Math.max(
    ctx.pomodoroSessions,
    ...allHistory.map((d) => d.pomodoroSessions),
  );

  return [
    {
      id: 'first_goal',
      title: 'Primer paso',
      description: 'Completa tu primera meta',
      icon: 'footsteps',
      unlocked: totalGoalsEver >= 1,
    },
    {
      id: 'streak_3',
      title: 'Constancia',
      description: '3 días de racha',
      icon: 'flame',
      unlocked: ctx.streak >= 3,
    },
    {
      id: 'streak_7',
      title: 'En fuego',
      description: '7 días de racha',
      icon: 'bonfire',
      unlocked: ctx.streak >= 7,
    },
    {
      id: 'perfect_day',
      title: 'Día perfecto',
      description: '100% de cumplimiento',
      icon: 'star',
      unlocked: perfectDay || allHistory.some((d) => getCompletionRate(d) === 100 && d.goalsTotal + d.habitsTotal > 0),
    },
    {
      id: 'pomodoro_5',
      title: 'Maratonista',
      description: '5 pomodoros en un día',
      icon: 'timer',
      unlocked: maxPomodoros >= 5,
    },
    {
      id: 'week_active',
      title: 'Semana fuerte',
      description: '5 días activos esta semana',
      icon: 'trophy',
      unlocked: activeDaysCount >= 5,
    },
  ];
};

export const getWeeklyInsight = (
  week: DailySnapshot[],
  streak: number,
): string => {
  const rates = week.map(getCompletionRate).filter((r) => r > 0);
  const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  const totalPomodoros = week.reduce((s, d) => s + d.pomodoroSessions, 0);
  const activeDays = week.filter(
    (d) => d.goalsCompleted + d.habitsCompleted > 0 || d.pomodoroSessions > 0,
  ).length;

  if (activeDays === 0) {
    return 'Esta semana está en blanco. Un pequeño paso hoy puede cambiar todo.';
  }
  if (avgRate >= 80 && streak >= 3) {
    return `Semana excelente: ${avgRate}% de cumplimiento promedio y racha de ${streak} días. Sigue así.`;
  }
  if (totalPomodoros >= 10) {
    return `${totalPomodoros} pomodoros esta semana. Tu enfoque profundo está dando frutos.`;
  }
  if (activeDays >= 5) {
    return `${activeDays} días activos de 7. La constancia es tu superpoder.`;
  }
  return `${avgRate}% de cumplimiento promedio. Cada día cuenta — retoma el ritmo mañana.`;
};
