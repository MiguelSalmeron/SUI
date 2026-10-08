import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { IDENTITY_COLORS, IDENTITY_EMOJIS, type UserIdentity } from '@sui/contracts';
export type LocalIdentity = UserIdentity & {
  localPhotoUri?: string;
  pending?: boolean;
  photoPending?: boolean;
};
export const defaultIdentity = (): LocalIdentity => ({
  schemaVersion: 1,
  avatarSource: 'initial',
  accentColor: 'blue',
});
interface IdentityState {
  owner: string | null;
  identity: LocalIdentity;
  identities: Record<string, LocalIdentity>;
  switchOwner: (owner: string | null) => void;
  update: (patch: Partial<LocalIdentity>) => void;
  setAccentColor: (color: UserIdentity['accentColor']) => void;
  setDetail: (source: 'initial' | 'generated' | 'emoji', detail?: string) => void;
  setLocalPhoto: (uri: string) => void;
  clearPhoto: () => void;
  reset: (owner?: string | null) => void;
}
export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      owner: null,
      identity: defaultIdentity(),
      identities: {},
      switchOwner: (owner) =>
        set((state) => ({
          owner,
          identity: owner ? (state.identities[owner] ?? defaultIdentity()) : defaultIdentity(),
        })),
      update: (patch) =>
        set((state) => {
          if (!state.owner) return state;
          const identity = { ...state.identity, ...patch, updatedAt: new Date().toISOString() };
          return { identity, identities: { ...state.identities, [state.owner]: identity } };
        }),
      setAccentColor: (accentColor) => {
        if (IDENTITY_COLORS.includes(accentColor)) get().update({ accentColor, pending: true });
      },
      setDetail: (source, detail) => {
        if (
          detail !== undefined &&
          !IDENTITY_EMOJIS.includes(detail as (typeof IDENTITY_EMOJIS)[number])
        )
          return;
        get().update({
          avatarSource: get().identity.avatarSource === 'photo' ? 'photo' : source,
          detail,
          pending: true,
        });
      },
      setLocalPhoto: (localPhotoUri) =>
        get().update({ localPhotoUri, avatarSource: 'photo', photoPending: true, pending: true }),
      clearPhoto: () =>
        get().update({
          photoPending: false,
          localPhotoUri: undefined,
          photoPath: undefined,
          photoUrl: undefined,
          photoVersion: undefined,
          avatarSource: get().identity.detail ? 'emoji' : 'initial',
          pending: true,
        }),
      reset: (owner) =>
        set((state) => {
          const identities = { ...state.identities };
          const target = owner ?? state.owner;
          if (target) delete identities[target];
          return target === state.owner
            ? { owner: null, identity: defaultIdentity(), identities }
            : { identities };
        }),
    }),
    {
      name: '@sui/identity-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ identities: state.identities }),
      merge: (persisted, current) => {
        const identities = (persisted as Pick<IdentityState, 'identities'>)?.identities ?? {};
        return {
          ...current,
          identities,
          identity: current.owner
            ? (identities[current.owner] ?? defaultIdentity())
            : defaultIdentity(),
        };
      },
    },
  ),
);
