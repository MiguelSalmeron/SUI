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
import { db } from '../config/firebase';

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
  version: 1,
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
    { label: 'Emergencias', phone: '911' },
    { label: 'Cruz Roja', phone: '128' },
  ],
};

const CONFIG_DOC_PATH = ['app_config', 'crisis'] as const;

/**
 * Descarga el diccionario de crisis al iniciar la app. Si falla (sin red,
 * doc inexistente), devuelve el respaldo empaquetado: NUNCA deja al usuario
 * sin protocolo de emergencia.
 */
export const fetchCrisisConfig = async (): Promise<CrisisConfig> => {
  try {
    const ref = doc(db, CONFIG_DOC_PATH[0], CONFIG_DOC_PATH[1]);
    const snap = await getDoc(ref);
    if (!snap.exists()) return DEFAULT_CRISIS_CONFIG;

    const data = snap.data() as Partial<CrisisConfig>;
    return {
      version: data.version ?? DEFAULT_CRISIS_CONFIG.version,
      keywords:
        Array.isArray(data.keywords) && data.keywords.length
          ? data.keywords
          : DEFAULT_CRISIS_CONFIG.keywords,
      title: data.title ?? DEFAULT_CRISIS_CONFIG.title,
      message: data.message ?? DEFAULT_CRISIS_CONFIG.message,
      contacts:
        Array.isArray(data.contacts) && data.contacts.length
          ? data.contacts
          : DEFAULT_CRISIS_CONFIG.contacts,
    };
  } catch (err) {
    console.warn('No se pudo cargar crisis config, usando respaldo:', err);
    return DEFAULT_CRISIS_CONFIG;
  }
};
