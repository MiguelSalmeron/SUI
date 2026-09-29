/**
 * Contratos de notificaciones accionables.
 *
 * Una acción tocada desde la notificación debe poder resolverse sin abrir la
 * aplicación, por eso el payload lleva sólo identificadores y horario.
 */

// ---------------------------------------------------------------------------
// Actionable Notifications Contracts
// ---------------------------------------------------------------------------
export type ActionableNotificationType = 'nightly_report' | 'habit_reminder' | 'morning_briefing';
export type ActionableActionId = 'COMPLETE_HABIT' | 'POSTPONE_15M' | 'OPEN_CHAT';

export interface ActionableNotificationPayload {
  type: ActionableNotificationType;
  habitId?: string;
  goalId?: string;
  scheduledTime?: string;
}
