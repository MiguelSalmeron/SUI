import { doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { avatarPath, parseIdentity, type UserIdentity } from '@sui/contracts';
import { auth, db, firebaseApp, getAppCheckToken } from '../firebase/firebase';
const base = process.env.EXPO_PUBLIC_CONNECTIONS_API_URL?.trim().replace(/\/$/, '') ?? '';
export const identityOwner = () => {
  const user = auth.currentUser;
  return user &&
    !user.isAnonymous &&
    (!user.providerData.some((p) => p.providerId === 'password') || user.emailVerified)
    ? user.uid
    : null;
};
export async function uploadAvatar(blob: Blob, uid: string): Promise<void> {
  if (
    identityOwner() !== uid ||
    blob.size > 1048576 ||
    !['image/webp', 'image/jpeg'].includes(blob.type)
  )
    throw new Error('Invalid photo');
  await uploadBytes(ref(getStorage(firebaseApp), avatarPath(uid)), blob, {
    contentType: blob.type,
  });
}
export async function updateRemoteIdentity(
  identity: UserIdentity,
  uid: string,
  clearPhoto = false,
): Promise<UserIdentity> {
  const user = auth.currentUser;
  if (!base || !user || identityOwner() !== uid) throw new Error('Identity unavailable');
  const payload = {
    schemaVersion: 1,
    avatarSource: identity.avatarSource,
    accentColor: identity.accentColor,
    detail: identity.detail,
    photoPath: identity.photoPath,
    photoVersion: identity.photoVersion,
  };
  const response = await fetch(`${base}/updateIdentity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
      'X-Firebase-AppCheck': await getAppCheckToken(),
    },
    body: JSON.stringify({ identity: payload, clearPhoto }),
  });
  if (!response.ok) throw new Error('Identity update failed');
  return (await response.json()).identity as UserIdentity;
}
export async function readRemoteIdentity(uid: string): Promise<UserIdentity | null> {
  const stored = (await getDoc(doc(db, 'users', uid))).data()?.identity;
  if (!stored) return null;
  const { photoUrl: _photoUrl, updatedAt: _updatedAt, ...wire } = stored;
  const identity = parseIdentity(wire, uid);
  if (!identity) return null;
  if (identity.photoPath) {
    try {
      identity.photoUrl = await getDownloadURL(ref(getStorage(firebaseApp), avatarPath(uid)));
    } catch {
      identity.photoUrl = undefined;
    }
  }
  return identity;
}
