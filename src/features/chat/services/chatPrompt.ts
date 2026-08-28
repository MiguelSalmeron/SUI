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
export const buildEmotionalProfile = ({
  name = '',
  goals = [],
  locale = 'es',
}: Partial<EmotionalProfile> = {}): EmotionalProfile => ({
  name,
  goals,
  locale,
  botPersonality: 'calm',
});

/**
 * Genera el system prompt empático. Mantiene tono cálido, breve y preventivo.
 * NO da diagnósticos clínicos; ante crisis, deriva (el overlay de emergencia
 * se dispara en cliente antes del envío vía detección de palabras clave).
 */
export const buildSystemPrompt = (p: EmotionalProfile): string => {
  const facts: string[] = [];
  if (p.name) facts.push(`Nombre: ${p.name}`);
  if (p.goals.length) facts.push(`Metas actuales: ${p.goals.join(', ')}`);

  let styleInstruction = 'Tu estilo es empático, suave, cálido y enfocado en la reducción del estrés.';
  if (p.botPersonality === 'direct') {
    styleInstruction = 'Tu estilo es directo, conciso, orientado a la productividad y a la acción sin rodeos.';
  } else if (p.botPersonality === 'coach') {
    styleInstruction = 'Tu estilo es un coach entusiasta y gamificado, motivando al usuario a mantener sus rachas y ganar XP.';
  }

  const ficha = facts.length
    ? `\n\nContexto voluntario:\n- ${facts.join('\n- ')}`
    : '';

  if (p.locale === 'en') {
    return (
      'You are Sui, a calm and focused wellbeing companion. Use short, human sentences in English. ' +
      'You are not a therapist and never provide diagnoses or medication advice. If there are signs of immediate danger, ' +
      'prioritize safety and encourage professional or emergency support. Avoid forced optimism and long lists.'
    );
  }

  return (
    'Eres Sui, un compañero preventivo de bienestar. ' +
    `${styleInstruction} ` +
    'Hablas en español, en segunda persona, con frases cortas y humanas. ' +
    'No eres un terapeuta ni das diagnósticos clínicos ni medicación. Si detectas señales de crisis grave ' +
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
