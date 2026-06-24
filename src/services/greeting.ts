/**
 * Saludo dinámico del tablero: cambia según la hora local y el progreso del
 * día. Función pura (sin estado ni React) para poder testearla y reutilizarla.
 *
 * No usa IA: es texto local instantáneo, siempre disponible offline.
 */

export interface Greeting {
  /** Saludo principal ("Buenos días"). El nombre se concatena en la UI. */
  salutation: string;
  /** Emoji acorde al momento del día. */
  emoji: string;
  /** Frase secundaria que reacciona al avance del día. */
  subline: string;
}

export interface GreetingInput {
  hour: number; // 0-23, hora local
  completed: number;
  total: number;
}

type DayPart = 'morning' | 'afternoon' | 'evening';

const dayPart = (hour: number): DayPart => {
  if (hour < 12) return 'morning';
  if (hour < 19) return 'afternoon';
  return 'evening';
};

const SALUTATION: Record<DayPart, { salutation: string; emoji: string }> = {
  morning: { salutation: 'Buenos días', emoji: '☀️' },
  afternoon: { salutation: 'Buenas tardes', emoji: '🌤️' },
  evening: { salutation: 'Buenas noches', emoji: '🌙' },
};

/**
 * Construye el saludo. La `subline` prioriza el progreso sobre la hora:
 * felicita al completar todo, motiva al arrancar y empuja suave al cerrar.
 */
export const buildGreeting = ({ hour, completed, total }: GreetingInput): Greeting => {
  const part = dayPart(hour);
  const { salutation, emoji } = SALUTATION[part];
  const pending = Math.max(total - completed, 0);

  let subline: string;
  if (total === 0) {
    subline = 'Agrega tu primera meta para empezar a medir tu día.';
  } else if (completed >= total) {
    subline = '¡Completaste todo hoy! Disfruta el logro. 🎉';
  } else if (part === 'morning' && completed === 0) {
    subline = `Tienes ${total} ${total === 1 ? 'meta' : 'metas'} para hoy. ¡Tú puedes! 💪`;
  } else if (part === 'evening' && pending > 0) {
    subline = `Te ${pending === 1 ? 'queda' : 'quedan'} ${pending} por cerrar. Aún hay tiempo. 🌙`;
  } else {
    subline = `Vas ${completed}/${total}. Sigue así, paso a paso.`;
  }

  return { salutation, emoji, subline };
};
