import { useEffect } from 'react';
import { removeLocalPhoto } from '@/shared/infrastructure/profile/localPhoto';
import { readRemoteIdentity } from '@/shared/infrastructure/profile/identityApi';
import { useIdentityStore } from './useIdentityStore';
export function useIdentitySession(
  owner: string | null,
  registered: boolean,
  loading: boolean,
): void {
  useEffect(() => {
    if (loading) return;
    let active = true;
    const start = async () => {
      const store = useIdentityStore.getState();
      store.switchOwner(owner);
      const snapshot = useIdentityStore.getState().identity;
      if (!owner || !registered || useIdentityStore.getState().identity.pending) return;
      try {
        const identity = await readRemoteIdentity(owner);
        const current = useIdentityStore.getState();
        if (active && identity && current.owner === owner && current.identity === snapshot) {
          const previousUri = current.identity.localPhotoUri;
          const localPhotoUri =
            identity.avatarSource === 'photo' &&
            identity.photoVersion === current.identity.photoVersion
              ? previousUri
              : undefined;
          current.update({ ...identity, localPhotoUri, pending: false, photoPending: false });
          if (!localPhotoUri) void removeLocalPhoto(previousUri).catch(() => undefined);
        }
      } catch {
        return;
      }
    };
    const unsubscribe = useIdentityStore.persist.hasHydrated()
      ? undefined
      : useIdentityStore.persist.onFinishHydration(() => {
          if (active) void start();
        });
    if (!unsubscribe) void start();
    return () => {
      active = false;
      unsubscribe?.();
      useIdentityStore.getState().switchOwner(null);
    };
  }, [owner, registered, loading]);
}
