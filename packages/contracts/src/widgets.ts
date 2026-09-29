/**
 * Contratos de widgets de pantalla de inicio.
 *
 * Forma mínima que el cliente publica y el widget lee sin depender del store
 * completo de productividad.
 */

import { isRecord, nonNegativeInteger } from './validation';

// ---------------------------------------------------------------------------
// Widget Contracts
// ---------------------------------------------------------------------------
export interface WidgetHabitItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface WidgetSnapshot {
  date: string;
  streakCount: number;
  nextActionTitle?: string;
  pendingHabits: WidgetHabitItem[];
  totalXp: number;
  level: number;
  lastUpdated: string;
}

export const parseWidgetSnapshot = (value: unknown): WidgetSnapshot | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.date !== 'string' ||
    !nonNegativeInteger(value.streakCount) ||
    !nonNegativeInteger(value.totalXp) ||
    !nonNegativeInteger(value.level) ||
    typeof value.lastUpdated !== 'string' ||
    !Array.isArray(value.pendingHabits)
  ) {
    return null;
  }
  const habitsValid = value.pendingHabits.every(
    (h) =>
      isRecord(h) &&
      typeof h.id === 'string' &&
      typeof h.title === 'string' &&
      typeof h.completed === 'boolean',
  );
  if (!habitsValid) return null;

  return {
    date: value.date,
    streakCount: value.streakCount,
    nextActionTitle: typeof value.nextActionTitle === 'string' ? value.nextActionTitle : undefined,
    pendingHabits: value.pendingHabits as WidgetHabitItem[],
    totalXp: value.totalXp,
    level: value.level,
    lastUpdated: value.lastUpdated,
  };
};
