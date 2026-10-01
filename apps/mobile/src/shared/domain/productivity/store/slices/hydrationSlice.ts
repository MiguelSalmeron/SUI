import type { StateCreator } from 'zustand';
import { auth } from '@/shared/infrastructure/firebase/firebase';
import { useIntroStore } from '@/shared/account/useIntroStore';
import { applyUserPreferences } from '@/shared/preferences/useSettingsStore';
import { loadLocalProductivity } from '../../persistence/productivityRepository';
import { normalizeLoadedData, statePatch } from '../productivityMappers';
import { productivityRuntime, waitForAuthReady } from '../productivityRuntime';
import type { ProductivityState } from '../productivityState';

export type HydrationActions = Pick<
  ProductivityState,
  'loadState' | 'reloadState' | 'handleAuthUserChanged'
>;

/**
 * Carga local y reacción a cambios de sesión.
 *
 * La premisa es local-first: apenas se lee el disco se pinta lo que haya
 * (`localLoaded`), y el bootstrap de nube corre después sin dejar la vista en
 * un esqueleto eterno. Si el disco falla, se marca cargado igual para que la
 * UI no se quede colgada.
 */
export const createHydrationSlice: StateCreator<ProductivityState, [], [], HydrationActions> = (
  set,
  get,
) => ({
  loadState: async () => {
    if (get().stateLoaded) return;
    try {
      await waitForAuthReady();
      const user = auth.currentUser;
      const currentUid = user?.uid;
      const envelope = await loadLocalProductivity(currentUid);
      productivityRuntime.loadedForUid = currentUid ?? null;
      if (envelope.data.preferences) {
        applyUserPreferences(envelope.data.preferences);
      }
      const normalized = normalizeLoadedData(envelope.data);
      const intro = useIntroStore.getState();
      const passwordProvider = user?.providerData.some((item) => item.providerId === 'password');
      const canSync = Boolean(
        intro.syncEnabled && user && !user.isAnonymous && (!passwordProvider || user.emailVerified),
      );
      const needsBootstrap =
        envelope.pullState.needsBootstrap || envelope.pullState.syncEpoch === null;

      if (canSync && needsBootstrap) {
        set({
          ...statePatch(normalized),
          localLoaded: true,
          syncStatus: 'syncing',
          lastSyncedAt: envelope.lastSyncedAt,
        });
        try {
          await get().syncNow();
        } finally {
          set({ stateLoaded: true });
        }
      } else {
        set({
          ...statePatch(normalized),
          localLoaded: true,
          stateLoaded: true,
          syncStatus: envelope.outbox.length ? 'pending' : 'local',
          lastSyncedAt: envelope.lastSyncedAt,
        });
        if (canSync) void get().syncNow();
      }
    } catch {
      // La lectura local falló: no hay nada que mostrar, así que la vista no
      // debe quedarse esperando un esqueleto eterno.
      set({ localLoaded: true, stateLoaded: true, syncStatus: 'error' });
    }
  },

  reloadState: async () => {
    set({ localLoaded: false, stateLoaded: false });
    await get().loadState();
  },

  handleAuthUserChanged: (uid) => {
    if (!get().stateLoaded || uid === productivityRuntime.loadedForUid) return;
    void get().reloadState();
  },
});
