/**
 * Detección de palabras clave de crisis en el cliente, ANTES de enviar el
 * mensaje al proxy. Si hay coincidencia, se muestra el EmergencyOverlay y
 * (según el flujo) se prioriza la derivación sobre la respuesta de la IA.
 */

import { CrisisConfig } from './crisisConfig';

/** Normaliza: minúsculas + sin acentos/diacríticos para comparación robusta. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Escapa caracteres especiales para construir el regex de forma segura. */
const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Compila un único regex (insensible) a partir del diccionario.
 * Memoizado por versión para no recompilar en cada pulsación.
 */
let cachedVersion = -1;
let cachedRegex: RegExp | null = null;

const getRegex = (config: CrisisConfig): RegExp | null => {
  if (config.version === cachedVersion && cachedRegex) return cachedRegex;

  const parts = config.keywords
    .map((k) => normalize(k).trim())
    .filter(Boolean)
    .map(escapeRegExp);

  if (parts.length === 0) {
    cachedRegex = null;
  } else {
    // (^|no-letra) frase (fin|no-letra) — evita falsos positivos parciales.
    cachedRegex = new RegExp(`(^|[^\\p{L}])(${parts.join('|')})([^\\p{L}]|$)`, 'iu');
  }
  cachedVersion = config.version;
  return cachedRegex;
};

/** Devuelve true si el texto contiene una señal de crisis. */
export const detectCrisis = (text: string, config: CrisisConfig): boolean => {
  const regex = getRegex(config);
  if (!regex) return false;
  return regex.test(normalize(text));
};
