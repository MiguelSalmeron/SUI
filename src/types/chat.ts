/**
 * Tipos y constantes del módulo de Chatbot IA (asistencia emocional).
 *
 * Privacidad: el historial vive SOLO en el dispositivo (AsyncStorage) y
 * caduca a las CHAT_TTL_MS. No se sincroniza a la nube.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** epoch ms — se usa para la caducidad de 48h. */
  createdAt: number;
  /** true mientras el asistente está escribiendo en streaming. */
  streaming?: boolean;
  /** true si el envío falló (permite reintento / aviso en UI). */
  error?: boolean;
}

/** Caducidad del historial local: 48 horas. */
export const CHAT_TTL_MS = 48 * 60 * 60 * 1000;

/** Cuántos turnos previos se inyectan en el prompt (control de costos). */
export const CONTEXT_WINDOW = 10;

/** Límite de caracteres del input del usuario (control de costos/tokens). */
export const MAX_INPUT_CHARS = 1000;

/**
 * "Ficha de Estado Emocional": contexto derivado del onboarding que se inyecta
 * como system prompt en cada conversación para personalizar la empatía.
 */
export interface EmotionalProfile {
  name: string;
  career: string;
  studyYear: number | null;
  /** Edad aproximada calculada desde el año de nacimiento. */
  age: number | null;
  /** Etiquetas de objetivos de bienestar elegidas en el onboarding. */
  goals: string[];
}

/** Mensaje (payload) listo para enviar al proxy: solo role + content. */
export interface PromptMessage {
  role: ChatRole;
  content: string;
}
