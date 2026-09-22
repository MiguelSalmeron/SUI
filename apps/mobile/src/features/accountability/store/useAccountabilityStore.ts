import { create } from 'zustand';
import {
  ACCOUNTABILITY_SCHEMA_VERSION,
  DEFAULT_PROFILE,
  MAX_ACTION_TEXT_LENGTH,
  MAX_COMMITMENTS,
  type AccountabilityCommitment,
  type AccountabilityEnvelopeV1,
  type AccountabilityIntensity,
  type AccountabilityProfile,
  type FollowUpCycle,
  type FollowUpFact,
  type ScheduleRule,
} from '../model/accountabilityTypes';
import { validateUserText } from '../model/accountabilityValidation';
import {
  cycleIdFor,
  commitmentIdFor,
  makeCycle,
  transitionCycle,
  type CycleEvent,
} from '../model/commitmentRules';
import {
  clearAccountability,
  enforceRetention,
  loadAccountability,
  writeAccountability,
} from '../services/accountabilityRepository';

/**
 * Store de Accountability (Fase 1): estado observable local, hidratación
 * uid-scoped y mutaciones que persisten de inmediato. Sin notificaciones
 * reales (Fase 2) ni UI (Fase 3).
 *
 * Igual que el resto del dominio: los errores de persistencia nunca bloquean
 * la interacción; el estado en memoria queda como fuente de la sesión.
 */

export type SaveOutcome =
  'saved' | 'invalid' | 'limit_reached' | 'not_found' | 'rejected_transition' | 'storage_error';

export type SaveResult = { outcome: SaveOutcome; envelope: AccountabilityEnvelopeV1 };

export type CreateCommitmentInput = {
  subjectType: 'goal' | 'habit';
  subjectId: string;
  intensity: AccountabilityIntensity;
  nextAction: string;
  minimumAction?: string;
  durationMinutes?: number;
  schedule: ScheduleRule;
  escalation: AccountabilityCommitment['escalation'];
};

interface AccountabilityState {
  profile: AccountabilityProfile;
  commitments: AccountabilityCommitment[];
  cycles: FollowUpCycle[];
  facts: FollowUpFact[];
  stateLoaded: boolean;

  loadState: (uid?: string | null) => Promise<void>;
  reloadState: (uid?: string | null) => Promise<void>;
  handleAuthUserChanged: (uid: string | null) => Promise<void>;
  /** Vacía el espacio local (logout invitado / borrado de cuenta). */
  clearLocal: () => Promise<void>;

  updateProfile: (patch: Partial<Omit<AccountabilityProfile, 'updatedAt'>>) => Promise<SaveResult>;
  upsertCommitment: (input: CreateCommitmentInput) => Promise<SaveResult>;
  disableCommitment: (subjectType: 'goal' | 'habit', subjectId: string) => Promise<SaveResult>;
  removeCommitment: (subjectType: 'goal' | 'habit', subjectId: string) => Promise<SaveResult>;
  /** Aplica un evento de ciclo a un ciclo existente (plan §4.3). */
  applyCycleEvent: (
    commitmentId: string,
    cycleId: string,
    event: CycleEvent,
  ) => Promise<SaveResult>;
  /** Registra un hecho de auditoría sobre un ciclo existente. */
  recordFact: (
    commitmentId: string,
    cycleId: string,
    fact: Omit<FollowUpFact, 'id' | 'cycleId'>,
  ) => Promise<SaveResult>;
  /** Garantiza la existencia de los ciclos indicados (idempotente, batch). */
  ensureCycles: (
    requested: { commitmentId: string; localDate: string; time: string }[],
  ) => Promise<SaveResult>;
  /** Aplica varios eventos de ciclo en un solo guardado (batch). */
  applyCycleEvents: (
    events: { commitmentId: string; cycleId: string; event: CycleEvent }[],
  ) => Promise<SaveResult>;
  /** Recorta el sobre a los topes de retención y persiste. */
  compact: () => Promise<SaveResult>;
  /** Edita agenda/intensidad/acción de un compromiso existente. */
  updateCommitment: (
    subjectType: 'goal' | 'habit',
    subjectId: string,
    patch: Partial<
      Pick<
        AccountabilityCommitment,
        'schedule' | 'intensity' | 'nextAction' | 'minimumAction' | 'durationMinutes' | 'escalation'
      >
    >,
  ) => Promise<SaveResult>;
  /** Check-in activo (sheet abierta desde notificación o app). */
  activeCheckIn: { commitmentId: string; cycleId: string } | null;
  openCheckIn: (commitmentId: string, cycleId: string) => void;
  closeCheckIn: () => void;
}

const nowIso = (): string => new Date().toISOString();

const fromEnvelope = (envelope: AccountabilityEnvelopeV1) => ({
  profile: envelope.profile,
  commitments: envelope.commitments,
  cycles: envelope.cycles,
  facts: envelope.facts,
});

export const useAccountabilityStore = create<AccountabilityState>((set, get) => {
  let currentUid: string | null = null;

  const snapshot = (): AccountabilityEnvelopeV1 => {
    const current = get();
    return {
      schemaVersion: ACCOUNTABILITY_SCHEMA_VERSION,
      profile: current.profile,
      commitments: current.commitments,
      cycles: current.cycles,
      facts: current.facts,
      updatedAt: nowIso(),
    };
  };

  /** Persiste el estado en memoria bajo el uid actual. Nunca lanza. */
  const persist = async (
    mutate?: (envelope: AccountabilityEnvelopeV1) => AccountabilityEnvelopeV1,
  ): Promise<SaveResult> => {
    const base = snapshot();
    const next = mutate ? enforceRetention(mutate(base)) : base;
    set(fromEnvelope(next));
    try {
      await writeAccountability(next, currentUid);
      return { outcome: 'saved', envelope: next };
    } catch {
      // Local-first: el fallo de disco no revierte el estado en memoria.
      return { outcome: 'storage_error', envelope: next };
    }
  };

  return {
    profile: { ...DEFAULT_PROFILE, updatedAt: '' },
    commitments: [],
    cycles: [],
    facts: [],
    stateLoaded: false,

    loadState: async (uid) => {
      currentUid = uid?.trim() ?? null;
      const envelope = await loadAccountability(currentUid);
      set({ ...fromEnvelope(envelope), stateLoaded: true });
    },

    reloadState: async (uid) => {
      await get().loadState(uid);
    },

    handleAuthUserChanged: async (uid) => {
      const nextUid = uid?.trim() ?? null;
      if (nextUid === currentUid && get().stateLoaded) return;
      await get().loadState(nextUid);
    },

    clearLocal: async () => {
      set({
        profile: { ...DEFAULT_PROFILE, updatedAt: '' },
        commitments: [],
        cycles: [],
        facts: [],
        stateLoaded: get().stateLoaded,
      });
      await clearAccountability(currentUid);
    },

    updateProfile: async (patch) =>
      persist((envelope) => ({
        ...envelope,
        profile: { ...envelope.profile, ...patch, updatedAt: nowIso() },
      })),

    upsertCommitment: async (input) => {
      if (!validateUserText(input.nextAction, MAX_ACTION_TEXT_LENGTH)) {
        return { outcome: 'invalid', envelope: snapshot() };
      }
      const commitmentId = commitmentIdFor(input.subjectType, input.subjectId);
      const existing = get().commitments.find((item) => item.id === commitmentId);
      if (!existing && get().commitments.length >= MAX_COMMITMENTS) {
        return { outcome: 'limit_reached', envelope: snapshot() };
      }
      const stamp = nowIso();
      const commitment: AccountabilityCommitment = {
        id: commitmentId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        enabled: true,
        intensity: input.intensity,
        nextAction: input.nextAction,
        ...(input.minimumAction ? { minimumAction: input.minimumAction } : {}),
        ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
        schedule: input.schedule,
        escalation: input.escalation,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      return persist((envelope) => ({
        ...envelope,
        commitments: [
          commitment,
          ...envelope.commitments.filter((item) => item.id !== commitmentId),
        ],
      }));
    },

    disableCommitment: async (subjectType, subjectId) => {
      const commitmentId = commitmentIdFor(subjectType, subjectId);
      const exists = get().commitments.some((item) => item.id === commitmentId);
      if (!exists) return { outcome: 'not_found', envelope: snapshot() };
      return persist((envelope) => ({
        ...envelope,
        commitments: envelope.commitments.map((item) =>
          item.id === commitmentId ? { ...item, enabled: false, updatedAt: nowIso() } : item,
        ),
      }));
    },

    removeCommitment: async (subjectType, subjectId) => {
      const commitmentId = commitmentIdFor(subjectType, subjectId);
      const exists = get().commitments.some((item) => item.id === commitmentId);
      if (!exists) return { outcome: 'not_found', envelope: snapshot() };
      return persist((envelope) => {
        const keptCycles = envelope.cycles.filter((cycle) => cycle.commitmentId !== commitmentId);
        const keptCycleIds = new Set(keptCycles.map((cycle) => cycle.id));
        return {
          ...envelope,
          commitments: envelope.commitments.filter((item) => item.id !== commitmentId),
          // Sin compromisos huérfanos: ciclos y hechos se van con él (plan §5.3).
          cycles: keptCycles,
          facts: envelope.facts.filter((fact) => keptCycleIds.has(fact.cycleId)),
        };
      });
    },

    applyCycleEvent: async (commitmentId, cycleId, event) => {
      const cycle = get().cycles.find((item) => item.id === cycleId);
      if (!cycle || cycle.commitmentId !== commitmentId) {
        return { outcome: 'not_found', envelope: snapshot() };
      }
      const patch = transitionCycle(cycle.status, event);
      if (!patch) return { outcome: 'rejected_transition', envelope: snapshot() };
      return persist((envelope) => ({
        ...envelope,
        cycles: envelope.cycles.map((item) =>
          item.id === cycleId
            ? {
                ...item,
                ...patch,
                attemptCount: patch.attemptCount ?? item.attemptCount,
                resolvedAt:
                  patch.resolvedAt === 'SET_NOW' ? nowIso() : (patch.resolvedAt ?? item.resolvedAt),
              }
            : item,
        ),
      }));
    },

    recordFact: async (commitmentId, cycleId, fact) => {
      const cycle = get().cycles.find((item) => item.id === cycleId);
      if (!cycle || cycle.commitmentId !== commitmentId) {
        return { outcome: 'not_found', envelope: snapshot() };
      }
      return persist((envelope) => ({
        ...envelope,
        facts: [{ ...fact, id: `${cycleId}:${fact.kind}:${nowIso()}`, cycleId }, ...envelope.facts],
      }));
    },

    ensureCycles: async (requested) => {
      const existing = new Map(get().cycles.map((cycle) => [cycle.id, cycle]));
      const additions: FollowUpCycle[] = [];
      for (const request of requested) {
        const id = cycleIdFor(request.commitmentId, request.localDate);
        if (existing.has(id) || additions.some((cycle) => cycle.id === id)) continue;
        const commitment = get().commitments.find((item) => item.id === request.commitmentId);
        if (!commitment) continue;
        additions.push(makeCycle(request.commitmentId, request));
      }
      if (additions.length === 0) return { outcome: 'saved', envelope: snapshot() };
      return persist((envelope) => ({
        ...envelope,
        cycles: [...envelope.cycles, ...additions],
      }));
    },

    applyCycleEvents: async (events) => {
      if (events.length === 0) return { outcome: 'saved', envelope: snapshot() };
      const cycles = new Map(get().cycles.map((cycle) => [cycle.id, cycle]));
      const applied = new Map<string, ReturnType<typeof transitionCycle> & object>();
      for (const { commitmentId, cycleId, event } of events) {
        const cycle = cycles.get(cycleId);
        if (!cycle || cycle.commitmentId !== commitmentId) continue;
        const current = applied.get(cycleId);
        const baselineStatus = current ? current.status : cycle.status;
        const patch = transitionCycle(baselineStatus, event);
        if (!patch) continue;
        applied.set(cycleId, {
          ...current,
          ...patch,
          attemptCount: patch.attemptCount ?? current?.attemptCount ?? cycle.attemptCount,
          completedAt: patch.completedAt ?? current?.completedAt ?? cycle.completedAt,
          resolvedAt:
            patch.resolvedAt === 'SET_NOW'
              ? nowIso()
              : (patch.resolvedAt ?? current?.resolvedAt ?? cycle.resolvedAt),
          resolution: patch.resolution ?? current?.resolution ?? cycle.resolution,
        });
      }
      if (applied.size === 0) return { outcome: 'saved', envelope: snapshot() };
      return persist((envelope) => ({
        ...envelope,
        cycles: envelope.cycles.map((cycle) =>
          applied.has(cycle.id) ? { ...cycle, ...applied.get(cycle.id)! } : cycle,
        ),
      }));
    },

    compact: async () => persist(),

    updateCommitment: async (subjectType, subjectId, patch) => {
      const commitmentId = commitmentIdFor(subjectType, subjectId);
      const exists = get().commitments.some((item) => item.id === commitmentId);
      if (!exists) return { outcome: 'not_found', envelope: snapshot() };
      if (
        patch.nextAction !== undefined &&
        !validateUserText(patch.nextAction, MAX_ACTION_TEXT_LENGTH)
      ) {
        return { outcome: 'invalid', envelope: snapshot() };
      }
      return persist((envelope) => ({
        ...envelope,
        commitments: envelope.commitments.map((item) =>
          item.id === commitmentId ? { ...item, ...patch, updatedAt: nowIso() } : item,
        ),
      }));
    },

    activeCheckIn: null,

    openCheckIn: (commitmentId, cycleId) => {
      set({ activeCheckIn: { commitmentId, cycleId } });
    },

    closeCheckIn: () => {
      set({ activeCheckIn: null });
    },
  };
});
