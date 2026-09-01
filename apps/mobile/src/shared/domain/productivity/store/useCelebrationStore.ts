import { create } from 'zustand';
import type { CelebrationKind } from '../model/celebration';
import { getCelebrationXp, playCelebrationHaptic } from '../model/celebration';

type CelebrationPayload = {
  kind: CelebrationKind;
  subtitle?: string;
};

type CelebrationState = {
  visible: boolean;
  kind: CelebrationKind | null;
  subtitle: string;
  xp: number;
  trigger: (payload: CelebrationPayload) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useCelebrationStore = create<CelebrationState>((set) => ({
  visible: false,
  kind: null,
  subtitle: '',
  xp: 0,

  trigger: ({ kind, subtitle }) => {
    if (hideTimer) clearTimeout(hideTimer);

    const xp = getCelebrationXp(kind);
    void playCelebrationHaptic(kind);

    set({
      visible: true,
      kind,
      subtitle: subtitle ?? (xp > 0 ? `+${xp} XP` : ''),
      xp,
    });

    hideTimer = setTimeout(() => {
      set({ visible: false });
      hideTimer = null;
    }, 2200);
  },

  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = null;
    set({ visible: false });
  },
}));
