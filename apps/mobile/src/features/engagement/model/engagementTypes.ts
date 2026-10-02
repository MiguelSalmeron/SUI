/**
 * Contrato local de Engagement (acompañamiento por franjas).
 *
 * Estado 100% local en la clave independiente `sui-engagement-v1`, separado de
 * `sui-accountability-v1` y de productividad v9. Acá no viaja nada a la nube:
 * las franjas se calculan en el propio teléfono y se materializan como
 * notificaciones locales.
 *
 * Decisión de producto (elegida): la cadencia arranca suave y sube sola según
 * la respuesta del usuario hasta llegar a ~1 aviso por hora; una franja sin
 * señal real se rellena con contenido ambiental derivado de datos reales, no
 * con mensajes genéricos de relleno.
 */

import type { DayOfWeek } from '@sui/contracts';

/** Sobre de persistencia propio, ajeno a productividad y accountability. */
export const ENGAGEMENT_SCHEMA_VERSION = 1 as const;

/** Clave base de AsyncStorage (se sufija con `:uid` para sesiones autenticadas). */
export const ENGAGEMENT_STORAGE_KEY = 'sui-engagement-v1';

/** Topes defensivos de tamaño; nada de datos sin límite en el dispositivo. */
export const MAX_ENGAGEMENT_SLOTS = 400;
export const MAX_ENGAGEMENT_FACTS = 600;

/** Longitud máxima del título de sujeto que se interpola en el copy. */
export const MAX_SUBJECT_TITLE_LENGTH = 60;

/**
 * Nivel de cadencia. Es el piso/target de avisos por día, no un techo duro:
 * `demanding` apunta a la ventana activa completa (~1 por hora).
 */
export type EngagementCadence = 'calm' | 'steady' | 'present' | 'demanding';

/** De dónde salió el contenido de una franja. */
export type EngagementSource =
  | 'habit_due'
  | 'habit_planned'
  | 'goal_momentum'
  | 'goal_progress'
  | 'goal_deadline'
  | 'streak'
  | 'inactivity'
  | 'briefing'
  | 'midday_focus'
  | 'afternoon_check'
  | 'evening_review'
  | 'reflection';

/** Sujeto referenciado por ID estable; engagement nunca lo muta. */
export type EngagementSubjectType = 'goal' | 'habit';

/** Estado de una franja programada. */
export type EngagementSlotStatus =
  'planned' | 'delivered' | 'opened' | 'responded' | 'dismissed' | 'skipped';

/** Ventana horaria protegida en minutos desde medianoche local. */
export interface EngagementQuietHours {
  /** Minuto de inicio, 0–1439. */
  startMinute: number;
  /** Minuto de fin, 0–1439; distinto de `startMinute` define la ventana activa. */
  endMinute: number;
}

/** Perfil global de acompañamiento (opt-in; `enabled` inicia en false). */
export interface EngagementProfile {
  enabled: boolean;
  /** Si está activo, la cadencia sube/baja sola según la respuesta observada. */
  adaptive: boolean;
  /** Nivel actual de cadencia. */
  cadence: EngagementCadence;
  /** Techo duro configurable: nunca se superan estos avisos por día. */
  maxNotificationsPerDay: number;
  quietHours: EngagementQuietHours;
  /** Días sin avisos (p. ej. `['sun']`). */
  restDays: DayOfWeek[];
  /** Rellena franjas sin señal con contenido ambiental de valor. */
  fillAmbient: boolean;
  /** Última fecha (YYYY-MM-DD) en la que se recalculó la cadencia adaptativa. */
  lastAdaptedOn?: string;
  updatedAt: string;
}

/** Una franja horaria con, a lo sumo, un aviso. ID estable por día + minuto. */
export interface EngagementSlot {
  id: string;
  /** Fecha local YYYY-MM-DD de la franja. */
  dayKey: string;
  /** Minuto local de inicio de la franja, 0–1439. */
  startMinute: number;
  status: EngagementSlotStatus;
  source?: EngagementSource;
  subjectType?: EngagementSubjectType;
  subjectId?: string;
}

/** Hecho mínimo de auditoría: explica por qué SUI avisó o qué hizo el usuario. */
export interface EngagementFact {
  id: string;
  slotId: string;
  kind: 'scheduled' | 'opened' | 'responded' | 'dismissed' | 'snoozed' | 'skipped';
  occurredAt: string;
  source: 'app' | 'notification' | 'system_reconcile';
}

/** Sobre de persistencia versionado. */
export interface EngagementEnvelopeV1 {
  schemaVersion: typeof ENGAGEMENT_SCHEMA_VERSION;
  profile: EngagementProfile;
  slots: EngagementSlot[];
  facts: EngagementFact[];
  updatedAt: string;
}

/** Valores por defecto: acompañamiento desactivado hasta consentimiento explícito. */
export const DEFAULT_ENGAGEMENT_PROFILE: Omit<EngagementProfile, 'updatedAt'> = {
  enabled: false,
  adaptive: true,
  cadence: 'calm',
  maxNotificationsPerDay: 15,
  quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 },
  restDays: [],
  fillAmbient: true,
};

export const EMPTY_ENGAGEMENT_ENVELOPE = (updatedAt = ''): EngagementEnvelopeV1 => ({
  schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
  profile: { ...DEFAULT_ENGAGEMENT_PROFILE, updatedAt },
  slots: [],
  facts: [],
  updatedAt,
});
