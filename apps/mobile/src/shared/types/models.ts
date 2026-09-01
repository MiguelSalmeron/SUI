import type { GoalGravity } from '@sui/contracts';

export type { DayOfWeek, Goal, GoalGravity, Habit, Milestone } from '@sui/contracts';

export type OriginType = 'google_calendar' | 'google_tasks' | 'habit' | 'goal';

export type GoogleEventType = 'class' | 'exam' | 'event';

/** Evento normalizado desde Google Calendar. */
export interface GoogleEvent {
  id: string;
  calendarId: string;
  title: string;
  date: string; // YYYY-MM-DD en la zona local del dispositivo
  time?: string; // HH:MM AM/PM para presentación
  startAt: string; // ISO original o fecha local de día completo
  endAt: string;
  allDay: boolean;
  timeZone?: string;
  location?: string;
  type: GoogleEventType;
  source: 'google';
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
  /** Timestamp ISO para ordenar sin depender del texto visible de la hora. */
  startAt?: string;
}
