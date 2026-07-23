import { create } from 'zustand';
import type { CelebrationKind } from '../services/celebration';
import {
  getCelebrationTitle,
  getCelebrationXp,
  playCelebrationHaptic,
} from '../services/celebration';

type CelebrationPayload = {
  kind: CelebrationKind;
  subtitle?: string;
};

type CelebrationState = {
  visible: boolean;
  title: string;
  subtitle: string;
  xp: number;
  trigger: (payload: CelebrationPayload) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useCelebrationStore = create<CelebrationState>((set) => ({
  visible: false,
  title: '',
  subtitle: '',
  xp: 0,

  trigger: ({ kind, subtitle }) => {
    if (hideTimer) clearTimeout(hideTimer);

    const title = getCelebrationTitle(kind);
    const xp = getCelebrationXp(kind);
    void playCelebrationHaptic(kind);

    set({
      visible: true,
      title,
      subtitle: subtitle ?? (xp > 0 ? `+${xp} XP` : 'Excelente constancia'),
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
