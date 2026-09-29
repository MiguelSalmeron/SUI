/**
 * Entidades del dominio de productividad que viajan entre cliente y backend.
 *
 * Son la forma canónica de metas, hábitos y snapshots diarios: el cliente las
 * serializa y el backend las valida con los mismos tipos.
 */

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export type GoalGravity = 'low' | 'high';

export interface Goal {
  id: string;
  title: string;
  deadline: string;
  progress: number;
  milestones: Milestone[];
  impactDays?: string[];
  completed: boolean;
  gravity: GoalGravity;
  createdAt: string;
  mirrorToGoogle?: boolean;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Habit {
  id: string;
  title: string;
  completed: boolean;
  frequency: 'daily' | DayOfWeek[];
  streak: number;
  lastCompletedDate?: string;
  frozenUntil?: string;
  linkedGoalId?: string | null;
  createdAt: string;
  plannedTime?: string;
  mirrorToGoogle?: boolean;
}

export interface DailySnapshot {
  date: string;
  goalsCompleted: number;
  goalsTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
}

export type ProductivityEntityType = 'goal' | 'habit' | 'snapshot';

export interface UserPreferences {
  schemaVersion: 1;
  theme?: 'system' | 'light' | 'dark';
  fontSize?: 'small' | 'medium' | 'large';
  language?: 'system' | 'es' | 'en';
  notificationsEnabled?: boolean;
  updatedAt?: string;
}

export interface ProductivitySummary {
  lastResetDate?: string;
  streakCount: number;
  lastCompletedDate?: string;
  totalXp: number;
  xpDelta?: number;
  preferences?: UserPreferences;
}
