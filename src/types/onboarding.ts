import * as z from 'zod';

/**
 * Catálogo de objetivos de bienestar recomendados por el sistema.
 * El usuario debe seleccionar exactamente GOALS_REQUIRED.
 */
export interface WellnessGoal {
  id: string;
  emoji: string;
  label: string;
}

export const GOALS_REQUIRED = 3;

export const WELLNESS_GOALS: WellnessGoal[] = [
  { id: 'sleep', emoji: '😴', label: 'Dormir mejor' },
  { id: 'stress', emoji: '🧘', label: 'Reducir el estrés' },
  { id: 'focus', emoji: '🎯', label: 'Estudiar con enfoque' },
  { id: 'exercise', emoji: '🏃', label: 'Hacer ejercicio' },
  { id: 'food', emoji: '🥗', label: 'Comer saludable' },
  { id: 'water', emoji: '💧', label: 'Tomar más agua' },
  { id: 'social', emoji: '🤝', label: 'Conectar con otros' },
  { id: 'breaks', emoji: '☕', label: 'Tomar pausas' },
];

export const getGoalById = (id: string): WellnessGoal | undefined =>
  WELLNESS_GOALS.find((goal) => goal.id === id);

/**
 * Pasos de la máquina de estados conversacional.
 * El orden define el avance del "Tunneling".
 */
export type OnboardingStep =
  | 'welcome'
  | 'name'
  | 'career'
  | 'studyYear'
  | 'birthYear'
  | 'goals'
  | 'submitting'
  | 'done';

export const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'name',
  'career',
  'studyYear',
  'birthYear',
  'goals',
  'submitting',
  'done',
];

export interface OnboardingProfile {
  name: string;
  career: string;
  studyYear: number | null;
  birthYear: number | null;
}

export const EMPTY_PROFILE: OnboardingProfile = {
  name: '',
  career: '',
  studyYear: null,
  birthYear: null,
};

// Opciones rápidas para el año de estudio.
export const STUDY_YEAR_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1er año' },
  { value: 2, label: '2do año' },
  { value: 3, label: '3er año' },
  { value: 4, label: '4to año' },
  { value: 5, label: '5to año' },
  { value: 6, label: '6to o más' },
];

// Esquemas de validación (zod) para las capturas de texto libre.
export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Escribe al menos 2 caracteres' })
  .max(40, { message: 'Máximo 40 caracteres' });

export const careerSchema = z
  .string()
  .trim()
  .min(2, { message: 'Escribe el nombre de tu carrera' })
  .max(60, { message: 'Máximo 60 caracteres' });

const CURRENT_YEAR = new Date().getFullYear();

export const birthYearSchema = z.coerce
  .number({ message: 'Ingresa un año válido' })
  .int({ message: 'Ingresa un año válido' })
  .gte(1940, { message: 'Ingresa un año válido' })
  .lte(CURRENT_YEAR - 15, {
    message: `El año debe ser anterior a ${CURRENT_YEAR - 15}`,
  });
