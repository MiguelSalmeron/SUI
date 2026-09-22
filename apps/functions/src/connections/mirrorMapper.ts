/**
 * Mapeo puro Sui -> Google Calendar (espejo selectivo, Fase 2).
 * Sin I/O, sin fetch, sin Firestore. Solo transforma entidades en cuerpos
 * de evento Google. Sui es fuente de verdad; Google es espejo de lectura.
 */

export type MirrorEntityType = 'goal' | 'habit';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface MirrorSourceGoal {
  suiType: 'goal';
  suiId: string;
  title: string;
  deadline: string;
  impactDays?: string[];
  completed: boolean;
  gravity?: 'low' | 'high';
  mirrorToGoogle?: boolean;
}

export interface MirrorSourceHabit {
  suiType: 'habit';
  suiId: string;
  title: string;
  frequency: 'daily' | DayOfWeek[];
  plannedTime?: string;
  completed: boolean;
  mirrorToGoogle?: boolean;
}

export type MirrorSource = MirrorSourceGoal | MirrorSourceHabit;

export interface GoogleEventBody {
  summary: string;
  description: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  extendedProperties: { private: { suiId: string; suiType: MirrorEntityType; suiSource: 'sui-v1' } };
  colorId?: string;
  status: 'confirmed';
}

const DAY_TO_RRULE: Record<DayOfWeek, string> = {
  mon: 'MO',
  tue: 'TU',
  wed: 'WE',
  thu: 'TH',
  fri: 'FR',
  sat: 'SA',
  sun: 'SU',
};

// Copia local de contracts.isPlannedTime: este módulo no puede importar
// @sui/contracts en runtime (ver scripts/vendor-contracts.mjs). Mantener sincronizado.
const isPlannedTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDays = (dateKey: string, days: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const cleanTitle = (title: string): string => {
  const trimmed = title.trim().slice(0, 240);
  return trimmed || 'Sui';
};

/** Regla espejo meta (duplica contracts.shouldMirrorGoal sin dependencia runtime). */
export const canMirrorGoal = (source: Pick<MirrorSourceGoal, 'deadline' | 'mirrorToGoogle'>): boolean => {
  if (source.mirrorToGoogle === false) return false;
  return isDateKey(source.deadline);
};

/** Regla espejo hábito (duplica contracts.shouldMirrorHabit sin dependencia runtime). */
export const canMirrorHabit = (
  source: Pick<MirrorSourceHabit, 'plannedTime' | 'mirrorToGoogle'>,
): boolean => source.mirrorToGoogle === true && isPlannedTime(source.plannedTime);

export const buildRecurrence = (
  frequency: 'daily' | DayOfWeek[],
): string[] | undefined => {
  if (frequency === 'daily') return ['RRULE:FREQ=DAILY'];
  if (!Array.isArray(frequency) || frequency.length === 0) return undefined;
  const days = frequency.filter((d): d is DayOfWeek => d in DAY_TO_RRULE).map((d) => DAY_TO_RRULE[d]);
  if (days.length === 0) return undefined;
  return [`RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`];
};

const descriptionFor = (suiType: MirrorEntityType, suiId: string): string =>
  `Creado por Sui · ${suiType} · ${suiId}`;

const goalBody = (source: MirrorSourceGoal): GoogleEventBody | null => {
  if (!canMirrorGoal(source)) return null;
  const days = (source.impactDays ?? [source.deadline]).filter(isDateKey).sort();
  const startDay = days[0] ?? source.deadline;
  const endDay = days.length > 1 ? addDays(days[days.length - 1], 1) : addDays(startDay, 1);
  return {
    summary: source.completed ? `✓ ${cleanTitle(source.title)}` : cleanTitle(source.title),
    description: descriptionFor('goal', source.suiId),
    start: { date: startDay },
    end: { date: endDay },
    extendedProperties: { private: { suiId: source.suiId, suiType: 'goal', suiSource: 'sui-v1' } },
    colorId: source.gravity === 'high' ? '11' : '9',
    status: 'confirmed',
  };
};

const habitBody = (
  source: MirrorSourceHabit,
  startDate: string,
  timeZone?: string,
): GoogleEventBody | null => {
  if (!canMirrorHabit(source) || !isDateKey(startDate)) return null;
  const time = source.plannedTime as string;
  const startAt = `${startDate}T${time}:00`;
  const [hh, mm] = time.split(':').map(Number);
  const endMinutes = hh * 60 + mm + 30;
  const endHh = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
  const endMm = String(endMinutes % 60).padStart(2, '0');
  const endDay = endMinutes >= 24 * 60 ? addDays(startDate, 1) : startDate;
  return {
    summary: source.completed ? `✓ ${cleanTitle(source.title)}` : cleanTitle(source.title),
    description: descriptionFor('habit', source.suiId),
    start: timeZone ? { dateTime: startAt, timeZone } : { dateTime: startAt },
    end: timeZone
      ? { dateTime: `${endDay}T${endHh}:${endMm}:00`, timeZone }
      : { dateTime: `${endDay}T${endHh}:${endMm}:00` },
    recurrence: buildRecurrence(source.frequency),
    extendedProperties: { private: { suiId: source.suiId, suiType: 'habit', suiSource: 'sui-v1' } },
    colorId: '10',
    status: 'confirmed',
  };
};

export const toGoogleEventBody = (
  source: MirrorSource,
  options: { startDate: string; timeZone?: string } = { startDate: new Date().toISOString().slice(0, 10) },
): GoogleEventBody | null => {
  if (source.suiType === 'goal') return goalBody(source);
  return habitBody(source, options.startDate, options.timeZone);
};

/** Huella estable para idempotencia: si no cambia, no se hace PATCH. */
export const fingerprintMirrorBody = (body: GoogleEventBody): string =>
  JSON.stringify({
    summary: body.summary,
    start: body.start,
    end: body.end,
    recurrence: body.recurrence ?? null,
    description: body.description,
  });
