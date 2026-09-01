/**
 * Configuración dinámica del protocolo de crisis.
 *
 * NOTA DE ARQUITECTURA: el plan original pedía Firebase Remote Config, pero el
 * SDK JS de Firebase (`firebase/remote-config`) es SOLO web y no funciona en
 * React Native / Hermes. Para mantener el objetivo (diccionario administrable
 * sin re-publicar la app) usamos un documento de Firestore como fuente
 * dinámica, con un diccionario por defecto empaquetado como respaldo offline.
 *
 * Documento esperado en Firestore:  app_config/crisis
 * (debe ser legible públicamente o por usuarios autenticados — ver reglas).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/infrastructure/firebase/firebase';
import type { Locale } from '@/shared/i18n/translations';

export interface EmergencyContact {
  label: string;
  /** Número en formato marcable (tel:). */
  phone: string;
}

export interface CrisisConfig {
  version: number;
  /** Palabras/frases que disparan el overlay (se normalizan al comparar). */
  keywords: string[];
  title: string;
  message: string;
  contacts: EmergencyContact[];
}

/**
 * Diccionario por defecto (respaldo). EDITAR los contactos según el país.
 * Estos valores también sirven como plantilla para el documento de Firestore.
 */
export const DEFAULT_CRISIS_CONFIG: CrisisConfig = {
  version: 2,
  keywords: [
    'suicidio',
    'suicidarme',
    'quiero morir',
    'me quiero morir',
    'matarme',
    'quitarme la vida',
    'acabar con todo',
    'no quiero vivir',
    'no quiero seguir',
    'hacerme dano',
    'lastimarme',
    'autolesion',
    'cortarme',
    'ya no aguanto',
    'no vale la pena vivir',
    'desaparecer para siempre',
  ],
  title: 'No estás solo/a',
  message:
    'Lo que sientes importa y mereces ayuda ahora mismo. Hablar con alguien ' +
    'puede aliviar el peso. Por favor contacta a una línea de apoyo o a una ' +
    'persona de confianza de inmediato.',
  contacts: [
    { label: 'Centro de Emergencias', phone: '118' },
    { label: 'Bomberos Unidos', phone: '115' },
  ],
};

const DEFAULT_CRISIS_CONFIG_EN: CrisisConfig = {
  ...DEFAULT_CRISIS_CONFIG,
  keywords: [
    'suicide',
    'kill myself',
    'want to die',
    'end my life',
    'do not want to live',
    "don't want to live",
    'hurt myself',
    'self harm',
  ],
  title: 'You are not alone',
  message:
    'What you feel matters and you deserve immediate support. Contact emergency services or a trusted person now.',
  contacts: [
    { label: 'Emergency center', phone: '118' },
    { label: 'Fire services', phone: '115' },
  ],
};

const fallbackFor = (locale: Locale): CrisisConfig =>
  locale === 'en' ? DEFAULT_CRISIS_CONFIG_EN : DEFAULT_CRISIS_CONFIG;

/**
 * Descarga el diccionario de crisis al iniciar la app. Si falla (sin red,
 * doc inexistente), devuelve el respaldo empaquetado: NUNCA deja al usuario
 * sin protocolo de emergencia.
 */
export const fetchCrisisConfig = async (
  locale: Locale = 'es',
  countryCode = 'NI',
): Promise<CrisisConfig> => {
  const fallback = fallbackFor(locale);
  try {
    const regionalRef = doc(
      db,
      'app_config',
      'crisis',
      'regions',
      `${countryCode.toUpperCase()}-${locale}`,
    );
    const baseRef = doc(db, 'app_config', 'crisis');
    const regional = await getDoc(regionalRef);
    const snap = regional.exists() ? regional : await getDoc(baseRef);
    if (!snap.exists()) return fallback;

    const data = snap.data() as Partial<CrisisConfig>;
    return {
      version: data.version ?? fallback.version,
      keywords:
        Array.isArray(data.keywords) && data.keywords.length ? data.keywords : fallback.keywords,
      title: data.title ?? fallback.title,
      message: data.message ?? fallback.message,
      contacts:
        Array.isArray(data.contacts) && data.contacts.length ? data.contacts : fallback.contacts,
    };
  } catch (err) {
    console.warn('No se pudo cargar crisis config, usando respaldo:', err);
    return fallback;
  }
};
