import * as z from 'zod';
import type { Ionicons } from '@expo/vector-icons';

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

export type BotPersonality = 'calm' | 'direct' | 'coach';
export type Chronotype = 'morning' | 'afternoon' | 'night';

export interface PopularCareer {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const POPULAR_CAREERS: PopularCareer[] = [
  { id: 'cs', label: 'Sistemas / TI', icon: 'desktop-outline' },
  { id: 'med', label: 'Salud / Medicina', icon: 'medical-outline' },
  { id: 'eng', label: 'Ingeniería', icon: 'hardware-chip-outline' },
  { id: 'law', label: 'Derecho / Leyes', icon: 'briefcase-outline' },
  { id: 'biz', label: 'Negocios / Admón', icon: 'bar-chart-outline' },
  { id: 'design', label: 'Diseño / Arte', icon: 'color-palette-outline' },
];

/**
 * Pasos de la máquina de estados conversacional.
 * El orden define el avance del "Tunneling".
 */
export type OnboardingStep =
  | 'welcome'
  | 'name'
  | 'hasRoute'
  | 'career'
  | 'botPersonality'
  | 'chronotype'
  | 'birthYear'
  | 'goals'
  | 'submitting'
  | 'done';

export const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'name',
  'hasRoute',
  'career',
  'botPersonality',
  'chronotype',
  'birthYear',
  'goals',
  'submitting',
  'done',
];

export interface OnboardingProfile {
  name: string;
  hasRoute?: 'yes' | 'no' | null;
  career: string;
  botPersonality?: BotPersonality | null;
  chronotype?: Chronotype | null;
  birthYear: number | null;
}

export const EMPTY_PROFILE: OnboardingProfile = {
  name: '',
  hasRoute: null,
  career: '',
  botPersonality: 'calm',
  chronotype: 'morning',
  birthYear: null,
};

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

// Rango de edad permitido: 8 a 80 años
export const birthYearSchema = z.coerce
  .number({ message: 'Ingresa un año válido (ej. 2005)' })
  .int({ message: 'Ingresa un año válido' })
  .gte(CURRENT_YEAR - 80, { message: `El año debe ser a partir de ${CURRENT_YEAR - 80}` })
  .lte(CURRENT_YEAR - 8, { message: `El año no puede ser superior a ${CURRENT_YEAR - 8}` });
