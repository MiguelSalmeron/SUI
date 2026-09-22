/**
 * Resolución de copy de Accountability (plan §8.3): la lógica produce
 * intenciones/llaves y este módulo resuelve títulos de sujetos y etiquetas.
 * Nunca concatena contenido libre sin límite ni envía texto a telemetría.
 */

import type { Goal } from '@sui/contracts';

export type AccountabilitySubject = Pick<Goal, 'id' | 'title'>;

/**
 * Título del sujeto (meta o hábito) a partir de las listas compartidas.
 * Devuelve cadena vacía si no existe: el caller decide el fallback.
 */
export const commitmentSubjectTitle = (
  subjectType: 'goal' | 'habit',
  subjectId: string,
  subjects: { goals?: AccountabilitySubject[]; habits?: AccountabilitySubject[] },
): string => {
  const pool = subjectType === 'goal' ? subjects.goals : subjects.habits;
  return pool?.find((item) => item.id === subjectId)?.title ?? '';
};
