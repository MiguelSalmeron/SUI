import { runStorageTask } from '@/shared/infrastructure/storage/storageTasks';
import { create } from 'zustand';
import {
  ENGAGEMENT_SCHEMA_VERSION,
  DEFAULT_ENGAGEMENT_PROFILE,
  type EngagementEnvelopeV1,
  type EngagementFact,
  type EngagementProfile,
  type EngagementSlot,
} from '../model/engagementTypes';
import {
  clearEngagement,
  getEngagementStorageKey,
  enforceEngagementRetention,
  loadEngagement,
  writeEngagement,
} from '../services/engagementRepository';

/**
 * Store de Engagement: estado observable local, hidratación uid-scoped y
 * mutaciones que persisten de inmediato. Igual que el resto del dominio, un
 * fallo de disco nunca revierte el estado en memoria.
 */

export type EngagementSaveOutcome = 'saved' | 'storage_error';

export type EngagementSaveResult = {
  outcome: EngagementSaveOutcome;
  envelope: EngagementEnvelopeV1;
};

interface EngagementState {
  profile: EngagementProfile;
  slots: EngagementSlot[];
  facts: EngagementFact[];
  stateLoaded: boolean;
  sessionVersion: number;

  loadState: (uid?: string | null) => Promise<void>;
  handleAuthUserChanged: (uid: string | null) => Promise<void>;
  clearLocal: () => Promise<void>;

  updateProfile: (
    patch: Partial<Omit<EngagementProfile, 'updatedAt'>>,
  ) => Promise<EngagementSaveResult>;
  /** Guarda las franjas del plan preservando el estado ya observado por franja. */
  setSlotsFromPlan: (slots: EngagementSlot[]) => Promise<EngagementSaveResult>;
  /** Registra hechos `scheduled` idempotentes para las franjas indicadas. */
  recordScheduledFacts: (slotIds: string[]) => Promise<EngagementSaveResult>;
  /** Marca una franja como abierta desde el toque de la notificación. */
  markOpened: (slotId: string) => Promise<EngagementSaveResult>;
  compact: () => Promise<EngagementSaveResult>;
}

const nowIso = (): string => new Date().toISOString();

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Clave local YYYY-MM-DD de hoy para discriminar franjas supersedidas. */
const localTodayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const fromEnvelope = (envelope: EngagementEnvelopeV1) => ({
  profile: envelope.profile,
  slots: envelope.slots,
  facts: envelope.facts,
});

export const useEngagementStore = create<EngagementState>((set, get) => {
  let currentUid: string | null = null;
  let sessionVersion = 0;

  const snapshot = (): EngagementEnvelopeV1 => {
    const current = get();
    return {
      schemaVersion: ENGAGEMENT_SCHEMA_VERSION,
      profile: current.profile,
      slots: current.slots,
      facts: current.facts,
      updatedAt: nowIso(),
    };
  };

  const persist = async (
    mutate?: (envelope: EngagementEnvelopeV1) => EngagementEnvelopeV1,
  ): Promise<EngagementSaveResult> => {
    if (!get().stateLoaded) return { outcome: 'storage_error', envelope: snapshot() };
    const uid = currentUid;
    const base = snapshot();
    const next = mutate ? enforceEngagementRetention(mutate(base)) : base;
    set(fromEnvelope(next));
    try {
      await writeEngagement(next, uid);
      return { outcome: 'saved', envelope: next };
    } catch {
      return { outcome: 'storage_error', envelope: next };
    }
  };

  return {
    profile: { ...DEFAULT_ENGAGEMENT_PROFILE, updatedAt: '' },
    slots: [],
    facts: [],
    stateLoaded: false,
    sessionVersion: 0,

    loadState: async (uid) => {
      const nextUid = uid?.trim() || null;
      const version = ++sessionVersion;
      currentUid = nextUid;
      set({
        profile: { ...DEFAULT_ENGAGEMENT_PROFILE, updatedAt: '' },
        slots: [],
        facts: [],
        stateLoaded: false,
        sessionVersion: version,
      });
      const envelope = await runStorageTask([getEngagementStorageKey(nextUid)], () =>
        loadEngagement(nextUid),
      );
      if (version !== sessionVersion) return;
      set({ ...fromEnvelope(envelope), stateLoaded: true });
    },

    handleAuthUserChanged: async (uid) => {
      const nextUid = uid?.trim() ?? null;
      if (nextUid === currentUid && get().stateLoaded) return;
      await get().loadState(nextUid);
    },

    clearLocal: async () => {
      const uid = currentUid;
      const version = ++sessionVersion;
      set({
        profile: { ...DEFAULT_ENGAGEMENT_PROFILE, updatedAt: '' },
        slots: [],
        facts: [],
        stateLoaded: true,
        sessionVersion: version,
      });
      await clearEngagement(uid);
    },

    updateProfile: async (patch) =>
      persist((envelope) => ({
        ...envelope,
        profile: { ...envelope.profile, ...patch, updatedAt: nowIso() },
      })),

    setSlotsFromPlan: async (slots) =>
      persist((envelope) => {
        const existing = new Map(envelope.slots.map((slot) => [slot.id, slot]));
        const planIds = new Set(slots.map((slot) => slot.id));
        // Franjas ya observadas (abierta/respondida) no se degradan a `planned`.
        const merged = slots.map((slot) => {
          const previous = existing.get(slot.id);
          return previous && previous.status !== 'planned'
            ? { ...slot, status: previous.status }
            : slot;
        });
        const today = localTodayKey();
        const history = envelope.slots.filter((slot) => {
          if (planIds.has(slot.id)) return false;
          // Al cambiar de cadencia el plan deja de contemplar franjas futuras o
          // de hoy aún no disparadas: se descartan del historial.
          if (slot.status === 'planned' && slot.dayKey >= today) return false;
          return true;
        });
        const surviving = [...history, ...merged];
        const survivingIds = new Set(surviving.map((slot) => slot.id));
        return {
          ...envelope,
          slots: surviving,
          // Un hecho sin franja rompería la validación al recargar: se van con
          // la franja descartada.
          facts: envelope.facts.filter((fact) => survivingIds.has(fact.slotId)),
        };
      }),

    recordScheduledFacts: async (slotIds) =>
      persist((envelope) => {
        const known = new Set(envelope.facts.map((fact) => fact.id));
        const additions: EngagementFact[] = [];
        for (const slotId of slotIds) {
          const id = `${slotId}:scheduled`;
          if (known.has(id)) continue;
          known.add(id);
          additions.push({
            id,
            slotId,
            kind: 'scheduled',
            occurredAt: nowIso(),
            source: 'system_reconcile',
          });
        }
        if (additions.length === 0) return envelope;
        return { ...envelope, facts: [...additions, ...envelope.facts] };
      }),

    markOpened: async (slotId) =>
      persist((envelope) => {
        const slot = envelope.slots.find((item) => item.id === slotId);
        if (!slot) return envelope;
        const factId = `${slotId}:opened`;
        const facts = envelope.facts.some((fact) => fact.id === factId)
          ? envelope.facts
          : [
              {
                id: factId,
                slotId,
                kind: 'opened' as const,
                occurredAt: nowIso(),
                source: 'notification' as const,
              },
              ...envelope.facts,
            ];
        return {
          ...envelope,
          slots: envelope.slots.map((item) =>
            item.id === slotId ? { ...item, status: 'opened' } : item,
          ),
          facts,
        };
      }),

    compact: async () => persist(),
  };
});
