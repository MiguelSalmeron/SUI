/**
 * Construcción del prompt del REPORTE NOCTURNO reflexivo (Motor de Resúmenes).
 *
 * A diferencia del chat conversacional, aquí inyectamos las estadísticas de
 * cumplimiento del día (metas + hábitos) y pedimos a la IA un cierre breve,
 * empático y personalizado según la ficha del estudiante (carrera/edad/objetivos).
 *
 * El resultado se muestra de forma EFÍMERA: no se persiste historial.
 */

import { EmotionalProfile, PromptMessage } from '../types/chat';
import { buildSystemPrompt } from './chatPrompt';

export interface DayStats {
  /** Títulos de las metas/hábitos completados hoy. */
  completed: string[];
  /** Títulos de las metas/hábitos pendientes hoy. */
  pending: string[];
  /** Días consecutivos de racha (0 si no hay racha activa). */
  streak?: number;
}

/** total = completados + pendientes. */
export const summarizeStats = (stats: DayStats) => {
  const total = stats.completed.length + stats.pending.length;
  const done = stats.completed.length;
  const ratio = total === 0 ? 0 : done / total;
  return { total, done, ratio, percent: Math.round(ratio * 100) };
};

/**
 * Arma el payload para el proxy de IA:
 *  [system: ficha + rol empático] + [user: estadísticas + petición de reporte].
 */
export const buildReportPayload = (
  profile: EmotionalProfile,
  stats: DayStats
): PromptMessage[] => {
  const { total, done, percent } = summarizeStats(stats);

  const completedLine = stats.completed.length
    ? `Completó: ${stats.completed.join(', ')}.`
    : 'No completó ninguna meta o hábito hoy.';
  const pendingLine = stats.pending.length
    ? `Quedó pendiente: ${stats.pending.join(', ')}.`
    : 'No dejó nada pendiente.';
  const streakLine =
    stats.streak && stats.streak > 1
      ? ` Lleva una racha de ${stats.streak} días seguidos cumpliendo; ` +
        'celébralo con naturalidad para reforzar la constancia.'
      : stats.streak === 1
      ? ' Hoy reinició su racha (día 1); anímalo a mantenerla mañana.'
      : '';

  const userContent =
    `Es el cierre del día. Balance de cumplimiento: ${done} de ${total} ` +
    `(${percent}%). ${completedLine} ${pendingLine}${streakLine}\n\n` +
    'Escribe un resumen nocturno breve (máx. 2 párrafos cortos), cálido y ' +
    'motivador. Reconoce su esfuerzo sin juzgar lo pendiente, conecta con su ' +
    'carrera o sus objetivos cuando ayude, y cierra con una intención sencilla ' +
    'para mañana. Tono humano, en segunda persona. Sin listas ni encabezados.';

  return [
    { role: 'system', content: buildSystemPrompt(profile) },
    { role: 'user', content: userContent },
  ];
};
