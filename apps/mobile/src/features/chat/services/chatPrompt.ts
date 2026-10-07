/**
 * Construcción del prompt híbrido del chatbot:
 *  - "Ficha de Estado Emocional" (system) derivada del onboarding.
 *  - Últimos N mensajes del historial (contexto conversacional).
 */

import { ChatMessage, CONTEXT_WINDOW, EmotionalProfile, PromptMessage } from '../types/chat';

/** Cuántas metas/hábitos se inyectan: suficiente pa anclar, sin quemar tokens. */
const MAX_CONTEXT_ITEMS = 3;
/** Tope de caracteres por título: evita que un título largo se coma el prompt. */
const MAX_CONTEXT_TITLE_CHARS = 80;

const cleanList = (items: string[] = []): string[] =>
  items
    .map((item) => item.trim().slice(0, MAX_CONTEXT_TITLE_CHARS))
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_ITEMS);

export const buildEmotionalProfile = ({
  name = '',
  goals = [],
  habits = [],
  timeOfDay,
  streak = 0,
  locale = 'es',
}: Partial<EmotionalProfile> = {}): EmotionalProfile => ({
  name: name.trim().slice(0, MAX_CONTEXT_TITLE_CHARS),
  goals: cleanList(goals),
  habits: cleanList(habits),
  timeOfDay,
  streak,
  locale,
  botPersonality: 'calm',
});

const styleLine = (p: EmotionalProfile): string => {
  if (p.botPersonality === 'direct')
    return 'Tu estilo es directo, conciso, orientado a la acción sin rodeos.';
  if (p.botPersonality === 'coach')
    return 'Tu estilo es de coach entusiasta: celebrás la constancia sin presionar.';
  return 'Tu estilo es empático, suave, cálido y enfocado en bajar el estrés.';
};

const timeLine = (p: EmotionalProfile): string => {
  const map = {
    morning: { es: 'Es de mañana', en: 'It is morning' },
    afternoon: { es: 'Es de tarde', en: 'It is afternoon' },
    evening: { es: 'Es de noche', en: 'It is evening' },
    night: { es: 'Es de madrugada', en: 'It is late night' },
  } as const;
  if (!p.timeOfDay) return '';
  return p.locale === 'en' ? `${map[p.timeOfDay].en}. ` : `${map[p.timeOfDay].es}. `;
};

/**
 * Genera el system prompt empático. Mantiene tono cálido, breve y preventivo.
 * NO da diagnósticos clínicos; ante crisis, deriva (el overlay de emergencia
 * se dispara en cliente antes del envío vía detección de palabras clave).
 *
 * Fijate que ES/EN comparten las mismas reglas: antes EN ignoraba la ficha y
 * el modelo respondía genérico según el idioma.
 */
export const buildSystemPrompt = (p: EmotionalProfile): string => {
  const facts: string[] = [];
  if (p.name) facts.push(p.locale === 'en' ? `Name: ${p.name}` : `Nombre: ${p.name}`);
  if (p.goals.length)
    facts.push(
      p.locale === 'en' ? `Active goals: ${p.goals.join(', ')}` : `Metas activas: ${p.goals.join(', ')}`,
    );
  if (p.habits.length)
    facts.push(
      p.locale === 'en' ? `Active habits: ${p.habits.join(', ')}` : `Hábitos activos: ${p.habits.join(', ')}`,
    );
  if (p.streak && p.streak > 1)
    facts.push(
      p.locale === 'en'
        ? `Current streak: ${p.streak} days`
        : `Racha actual: ${p.streak} días seguidos`,
    );

  const ficha = facts.length
    ? p.locale === 'en'
      ? `\n\nVoluntary context:\n- ${facts.join('\n- ')}`
      : `\n\nContexto voluntario:\n- ${facts.join('\n- ')}`
    : '';

  if (p.locale === 'en') {
    return (
      'You are Sui, a calm preventive wellbeing companion. Use short, human sentences in English. ' +
      `${timeLine(p)}` +
      'You are not a therapist and never provide diagnoses or medication advice. If there are signs of immediate danger, ' +
      'prioritize safety and encourage professional or emergency support. ' +
      'Rules: max 80 words in 1-2 short paragraphs, no lists or headings. ' +
      'Validate in one sentence, then propose ONE concrete micro-action (max 20 min) tied to a goal or habit cited by name; ' +
      'if there is no context, propose a neutral first step without inventing data. ' +
      'Close with one brief open question. Second person, human tone, no forced optimism.' +
      ficha
    );
  }

  return (
    'Eres Sui, un compañero preventivo de bienestar. ' +
    `${styleLine(p)} ` +
    `${timeLine(p)}` +
    'Hablas en español, en segunda persona, con frases cortas y humanas. ' +
    'No eres un terapeuta ni das diagnósticos clínicos ni medicación. Si detectas señales de crisis grave ' +
    '(autolesión, suicidio, peligro inmediato), prioriza acompañar y anima a ' +
    'la persona a buscar ayuda profesional o líneas de emergencia de inmediato. ' +
    'Reglas: máximo 80 palabras en 1-2 párrafos cortos, sin listas ni encabezados. ' +
    'Validá en una frase, después proponé UNA sola micro-acción concreta (máx. 20 min) ' +
    'ligada a una meta o hábito citado por nombre; si no hay contexto, proponé un primer paso ' +
    'neutro sin inventar datos. Cerrá con una pregunta abierta breve. Nada de optimismo forzado.' +
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
  history: ChatMessage[],
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
