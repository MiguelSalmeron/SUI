import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoogleEvent, TimelineItem, Goal, Habit } from '../types/models';
import { localDateKey, isHabitDueToday } from './homeStorage';

const GOOGLE_EVENTS_CACHE_KEY = '@sui/google-events-v1';

// Datos de demostración de clases universitarias
const DEMO_GOOGLE_EVENTS: GoogleEvent[] = [
  {
    id: 'g-event-1',
    title: 'Clase de Física Universitaria',
    date: localDateKey(),
    time: '08:00 AM',
    location: 'Aula 302',
    type: 'class',
  },
  {
    id: 'g-event-2',
    title: 'Laboratorio de Estructuras de Datos',
    date: localDateKey(),
    time: '02:00 PM',
    location: 'Lab de Cómputo B',
    type: 'class',
  },
];

/**
 * Carga eventos de Google desde caché local o siembra los eventos demo por defecto.
 */
export const loadCachedGoogleEvents = async (): Promise<GoogleEvent[]> => {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_EVENTS_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    // Guardar demo por defecto
    await AsyncStorage.setItem(GOOGLE_EVENTS_CACHE_KEY, JSON.stringify(DEMO_GOOGLE_EVENTS));
    return DEMO_GOOGLE_EVENTS;
  } catch {
    return DEMO_GOOGLE_EVENTS;
  }
};

/**
 * Guarda o actualiza eventos de Google en caché local.
 */
export const saveGoogleEventsCache = async (events: GoogleEvent[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(GOOGLE_EVENTS_CACHE_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('Error al guardar caché de Google:', err);
  }
};

/**
 * Fusiona y normaliza Google Events, Hábitos SUI y Metas SUI en un único TimelineItem[]
 * ordenado cronológicamente por hora/prioridad.
 */
export const buildUnifiedTimeline = (
  dateKey: string,
  googleEvents: GoogleEvent[],
  goals: Goal[],
  habits: Habit[],
): TimelineItem[] => {
  const items: TimelineItem[] = [];
  const dateObj = new Date(dateKey + 'T00:00:00');

  // 1. Eventos de Google Calendar para esta fecha
  const dayEvents = googleEvents.filter((ev) => ev.date === dateKey);
  dayEvents.forEach((ev) => {
    items.push({
      id: `timeline-google-${ev.id}`,
      title: `${ev.title}${ev.location ? ` · ${ev.location}` : ''}`,
      date: ev.date,
      time: ev.time ?? '08:00 AM',
      completed: true, // Informativo
      origin: 'google_calendar',
      originalId: ev.id,
    });
  });

  // 2. Hábitos SUI programados para esta fecha
  const dayHabits = habits.filter((h) => isHabitDueToday(h, dateObj));
  dayHabits.forEach((h, idx) => {
    const linkedGoal = goals.find((g) => g.id === h.linkedGoalId);
    // Asignar horas distribuidas si no tienen hora fija
    const defaultHours = ['07:30 AM', '10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM'];
    const assignedTime = defaultHours[idx % defaultHours.length];

    items.push({
      id: `timeline-habit-${h.id}`,
      title: h.title,
      date: dateKey,
      time: assignedTime,
      completed: h.completed,
      origin: 'habit',
      streak: h.streak,
      linkedGoalTitle: linkedGoal?.title,
      originalId: h.id,
    });
  });

  // 3. Metas con fecha límite en esta fecha
  const dayGoals = goals.filter((g) => g.deadline === dateKey || g.impactDays?.includes(dateKey));
  dayGoals.forEach((g) => {
    items.push({
      id: `timeline-goal-${g.id}`,
      title: `ENTREGA: ${g.title}`,
      date: dateKey,
      time: '11:59 PM',
      completed: g.completed,
      origin: 'goal',
      gravity: g.gravity,
      originalId: g.id,
    });
  });

  // Ordenar cronológicamente por hora asignada
  return items.sort((a, b) => {
    const timeA = a.time ?? '23:59';
    const timeB = b.time ?? '23:59';
    return timeA.localeCompare(timeB);
  });
};
