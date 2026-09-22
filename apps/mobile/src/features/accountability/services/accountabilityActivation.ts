/**
 * Activación de seguimiento desde Metas/Hábitos (plan §8.1): el CTA opcional
 * "Activar seguimiento" tras guardar/editar una entidad. Activar un
 * compromiso implica el consentimiento explícito del perfil (ADR-0008 §3):
 * se marca `enabled` y se reconcilia para programar de inmediato.
 */

import { useAccountabilityStore } from '../store/useAccountabilityStore';
import type {
  AccountabilityIntensity,
  EscalationPolicy,
  ScheduleRule,
} from '../model/accountabilityTypes';
import { reconcileAccountability } from './accountabilityReconciler';

export type ActivateFollowUpInput = {
  subjectType: 'goal' | 'habit';
  subjectId: string;
  nextAction: string;
  minimumAction?: string;
  durationMinutes?: number;
  intensity: AccountabilityIntensity;
  escalation: EscalationPolicy;
  schedule: ScheduleRule;
};

/** Activa (o re-activa) el seguimiento de una meta/hábito y reconcilia. */
export const activateFollowUp = async (
  input: ActivateFollowUpInput,
): Promise<'saved' | 'invalid' | 'limit_reached' | 'not_found' | 'rejected_transition' | 'storage_error'> => {
  const store = useAccountabilityStore.getState();
  // Consentimiento explícito: la primera activación enciende el perfil.
  if (!store.profile.enabled) await store.updateProfile({ enabled: true });
  const result = await store.upsertCommitment({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    intensity: input.intensity,
    nextAction: input.nextAction,
    ...(input.minimumAction ? { minimumAction: input.minimumAction } : {}),
    ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
    schedule: input.schedule,
    escalation: input.escalation,
  });
  if (result.outcome === 'saved') await reconcileAccountability();
  return result.outcome;
};

/** Desactiva el seguimiento de una meta/hábito y reconcilia (cancela alertas). */
export const deactivateFollowUp = async (subjectType: 'goal' | 'habit', subjectId: string): Promise<void> => {
  const store = useAccountabilityStore.getState();
  await store.disableCommitment(subjectType, subjectId);
  await reconcileAccountability();
};
