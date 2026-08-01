export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export type GoalGravity = 'low' | 'high'; // low = Amarillo 🟡, high = Rojo 🔴

export interface Goal {
  id: string;
  title: string;
  deadline: string; // YYYY-MM-DD
  progress: number; // 0 a 100
  milestones: Milestone[];
  impactDays: string[]; // Fechas YYYY-MM-DD
  completed: boolean;
  gravity: GoalGravity;
  createdAt: string;
}

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Habit {
  id: string;
  title: string;
  completed: boolean;
  frequency: 'daily' | DayOfWeek[];
  streak: number;
  lastCompletedDate?: string;
  frozenUntil?: string; // Fecha hasta la que está congelada la racha
  linkedGoalId?: string | null;
  createdAt: string;
}

export type OriginType = 'google_calendar' | 'google_tasks' | 'habit' | 'goal';

export interface GoogleEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h)
  location?: string;
  type: 'class' | 'exam' | 'event';
}

export interface TimelineItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM o undefined para todo el día
  completed: boolean;
  origin: OriginType;
  linkedGoalTitle?: string;
  streak?: number;
  gravity?: GoalGravity;
  originalId: string;
}
