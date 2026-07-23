/**
 * Construcción del prompt híbrido del chatbot:
 *  - "Ficha de Estado Emocional" (system) derivada del onboarding.
 *  - Últimos N mensajes del historial (contexto conversacional).
 */

import {
  ChatMessage,
  CONTEXT_WINDOW,
  EmotionalProfile,
  PromptMessage,
} from '../types/chat';
import { getGoalById } from '../types/onboarding';
import { OnboardingProfile } from '../types/onboarding';

/** Deriva la Ficha Emocional desde el perfil de onboarding + objetivos. */
export const buildEmotionalProfile = (
  profile: OnboardingProfile,
  selectedGoals: string[]
): EmotionalProfile => {
  const currentYear = new Date().getFullYear();
  const age =
    profile.birthYear && profile.birthYear > 1900
      ? currentYear - profile.birthYear
      : null;

  const goals = selectedGoals
    .map((id) => getGoalById(id)?.label)
    .filter((label): label is string => Boolean(label));

  return {
    name: profile.name,
    career: profile.career,
    studyYear: profile.studyYear,
    age,
    goals,
  };
};

/**
 * Genera el system prompt empático. Mantiene tono cálido, breve y preventivo.
 * NO da diagnósticos clínicos; ante crisis, deriva (el overlay de emergencia
 * se dispara en cliente antes del envío vía detección de palabras clave).
 */
export const buildSystemPrompt = (p: EmotionalProfile): string => {
  const facts: string[] = [];
  if (p.name) facts.push(`Nombre: ${p.name}`);
  if (p.career) facts.push(`Carrera: ${p.career}`);
  if (p.studyYear) facts.push(`Año de estudio: ${p.studyYear}`);
  if (p.age) facts.push(`Edad aproximada: ${p.age} años`);
  if (p.goals.length) facts.push(`Objetivos de bienestar: ${p.goals.join(', ')}`);

  const ficha = facts.length
    ? `\n\nFicha del estudiante:\n- ${facts.join('\n- ')}`
    : '';

  return (
    'Eres SUI, un compañero preventivo de bienestar para estudiantes ' +
    'universitarios. Tu rol es escuchar con empatía, validar emociones y ' +
    'ofrecer apoyo breve, cálido y práctico. Hablas en español, en segunda ' +
    'persona, con frases cortas y humanas. No eres un terapeuta ni das ' +
    'diagnósticos clínicos ni medicación. Si detectas señales de crisis grave ' +
    '(autolesión, suicidio, peligro inmediato), prioriza acompañar y anima a ' +
    'la persona a buscar ayuda profesional o líneas de emergencia de inmediato. ' +
    'Evita respuestas largas o listas extensas; prioriza la conexión humana.' +
    ficha
  );
};

/**
 * Arma el payload final para el proxy:
 *  [system (ficha)] + últimos CONTEXT_WINDOW mensajes de usuario/asistente.
 * Se descartan mensajes vacíos, en error o todavía en streaming.
 */
export const buildPayload = (
  profile: EmotionalProfile,
  history: ChatMessage[]
): PromptMessage[] => {
  const system: PromptMessage = {
    role: 'system',
    content: buildSystemPrompt(profile),
  };

  const recent = history
    .filter((m) => m.role !== 'system' && !m.error && !m.streaming && m.content.trim())
    .slice(-CONTEXT_WINDOW)
    .map<PromptMessage>((m) => ({ role: m.role, content: m.content }));

  return [system, ...recent];
};
