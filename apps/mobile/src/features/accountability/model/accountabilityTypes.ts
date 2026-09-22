/**
 * Contrato local de Accountability (Fase 1) — ACCOUNTABILITY_PLAN.md §6.
 *
 * Estado 100% local en la clave independiente `sui-accountability-v1`.
 * Nunca se serializa hacia `sui-productivity-v9`, outbox, resumen ni Firestore.
 * Los compromisos referencian metas/hábitos sólo por ID estable.
 */

import type { DayOfWeek } from '@sui/contracts';

/** Sobre de persistencia propia, separado de productividad v9. */
export const ACCOUNTABILITY_SCHEMA_VERSION = 1 as const;

/** Clave base de AsyncStorage (se sufija con `:uid` para sesiones autenticadas). */
export const ACCOUNTABILITY_STORAGE_KEY = 'sui-accountability-v1';

/** Máximo de compromisos activos simultáneos (límite defensivo de tamaño). */
export const MAX_COMMITMENTS = 100;

/** Máximo de ciclos retenidos en el dispositivo por compromiso. */
export const MAX_CYCLES_PER_COMMITMENT = 50;

/** Máximo de hechos retenidos en el dispositivo (compactables en fases futuras). */
export const MAX_FACTS = 500;

/** Límite de longitud para texto libre visible al usuario. */
export const MAX_ACTION_TEXT_LENGTH = 120;

/** Límite de longitud para notas breves locales (Fase 3). */
export const MAX_NOTE_LENGTH = 280;

/** Intensidad del seguimiento. */
export type AccountabilityIntensity = 'soft' | 'firm' | 'demanding' | 'custom';

/** Tono de SUI. No es un diagnóstico: es una preferencia de copy. */
export type AccountabilityPersonality = 'coach' | 'direct' | 'partner' | 'mentor' | 'minimal';

/** Días de la semana reutilizados del contrato compartido. */
export type AccountabilityDay = DayOfWeek;

/** Ventana horaria protegida en minutos desde medianoche local. */
export interface QuietHours {
  /** Minuto de inicio, 0–1439. */
  startMinute: number;
  /** Minuto de fin, 0–1439; menor que startMinute indica cruce de medianoche. */
  endMinute: number;
}

/** Perfil global de seguimiento (opt-in; `enabled` inicia en false). */
export interface AccountabilityProfile {
  enabled: boolean;
  defaultIntensity: AccountabilityIntensity;
  personality: AccountabilityPersonality;
  /** Máximo de alertas por día en todo el sistema (plan §7.3: valor inicial 4). */
  maxNotificationsPerDay: number;
  quietHours: QuietHours;
  /** Días de descanso sin notificación (p. ej. `['sun']`). */
  restDays: AccountabilityDay[];
  allowEscalation: boolean;
  allowNotificationActions: boolean;
  weeklyDigestEnabled: boolean;
  updatedAt: string;
}

/** Regla de retraso: qué hacer si no hay respuesta. */
export type EscalationPolicy = 'reschedule_or_minimum' | 'minimum_only' | 'notify_once';

/** Regla de agenda de un compromiso. */
export type ScheduleRule =
  | { kind: 'once'; date: string; time: string }
  | { kind: 'daily'; time: string }
  | { kind: 'weekly'; days: AccountabilityDay[]; time: string };

/** Compromiso de seguimiento sobre una meta o hábito existente (sólo IDs). */
export interface AccountabilityCommitment {
  id: string;
  subjectType: 'goal' | 'habit';
  subjectId: string;
  enabled: boolean;
  intensity: AccountabilityIntensity;
  /** Próxima acción observable, texto visible (nunca ejecutada por el motor). */
  nextAction: string;
  /** Versión mínima aceptable si el usuario no puede con la acción completa. */
  minimumAction?: string;
  durationMinutes?: number;
  schedule: ScheduleRule;
  escalation: EscalationPolicy;
  createdAt: string;
  updatedAt: string;
}

/**
 * Estados de ciclo (plan §3.4/§4.3). `unknown` nunca se presenta como fracaso:
 * la ausencia de datos no equivale a incumplimiento.
 */
export type CycleStatus =
  | 'configured'
  | 'scheduled'
  | 'due'
  | 'acknowledged'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'unknown'
  | 'rescheduled'
  | 'reduced'
  | 'paused'
  | 'abandoned';

/** Un ciclo de seguimiento: una ventana esperada de una acción. */
export interface FollowUpCycle {
  id: string;
  commitmentId: string;
  /** Fecha local YYYY-MM-DD de la ventana. */
  localDate: string;
  /** Hora local HH:MM de inicio de la ventana. */
  time: string;
  status: CycleStatus;
  attemptCount: number;
  completedAt?: string;
  resolvedAt?: string;
  resolution?: 'completed' | 'continued' | 'reduced' | 'rescheduled' | 'paused' | 'abandoned';
}

/** Hecho mínimo de auditoría, compactable; explica por qué SUI notificó. */
export interface FollowUpFact {
  id: string;
  cycleId: string;
  kind: 'scheduled' | 'opened' | 'check_in' | 'snoozed' | 'completed' | 'rescheduled' | 'paused';
  occurredAt: string;
  source: 'app' | 'notification' | 'system_reconcile';
  value?: string;
}

/** Sobre de persistencia versionado. */
export interface AccountabilityEnvelopeV1 {
  schemaVersion: typeof ACCOUNTABILITY_SCHEMA_VERSION;
  profile: AccountabilityProfile;
  commitments: AccountabilityCommitment[];
  cycles: FollowUpCycle[];
  facts: FollowUpFact[];
  updatedAt: string;
}

/** Resultado de validar contenido libre del usuario. */
export type TextValidation = { ok: true } | { ok: false; reason: 'too_long' | 'empty' };

/** Valores por defecto del perfil: seguimiento desactivado (plan §3.1). */
export const DEFAULT_PROFILE: Omit<AccountabilityProfile, 'updatedAt'> = {
  enabled: false,
  defaultIntensity: 'firm',
  personality: 'direct',
  maxNotificationsPerDay: 4,
  quietHours: { startMinute: 22 * 60, endMinute: 7 * 60 },
  restDays: [],
  allowEscalation: true,
  allowNotificationActions: true,
  weeklyDigestEnabled: true,
};

export const EMPTY_ENVELOPE = (updatedAt = ''): AccountabilityEnvelopeV1 => ({
  schemaVersion: ACCOUNTABILITY_SCHEMA_VERSION,
  profile: { ...DEFAULT_PROFILE, updatedAt },
  commitments: [],
  cycles: [],
  facts: [],
  updatedAt,
});
