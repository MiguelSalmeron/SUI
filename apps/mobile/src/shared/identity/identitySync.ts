import { avatarPath } from '@sui/contracts';
import {
  identityOwner,
  uploadAvatar,
  updateRemoteIdentity,
} from '@/shared/infrastructure/profile/identityApi';
import { photoBlob } from '@/shared/infrastructure/profile/localPhoto';
import { useIdentityStore } from './useIdentityStore';
let queue: Promise<unknown> = Promise.resolve();
export function syncIdentity(clearPhoto = false): Promise<void> {
  const owner = useIdentityStore.getState().owner;
  const operation = queue
    .catch(() => undefined)
    .then(async () => {
      const state = useIdentityStore.getState();
      const uid = identityOwner();
      if (!uid || owner !== uid || state.owner !== owner) return;
      const identity = { ...state.identity };
      const snapshot = state.identity;
      if (identity.avatarSource === 'photo' && identity.localPhotoUri && identity.photoPending) {
        const blob = await photoBlob(identity.localPhotoUri);
        if (useIdentityStore.getState().owner !== owner || identityOwner() !== uid) return;
        await uploadAvatar(blob, uid);
        identity.photoPath = avatarPath(uid);
        identity.photoVersion = Date.now();
      }
      if (useIdentityStore.getState().owner !== owner || identityOwner() !== uid) return;
      const remote = await updateRemoteIdentity(
        identity,
        uid,
        (clearPhoto || !identity.photoPath) && identity.avatarSource !== 'photo',
      );
      const current = useIdentityStore.getState();
      if (current.owner === owner && current.identity === snapshot)
        current.update({ ...remote, pending: false, photoPending: false });
    });
  queue = operation;
  return operation;
}
