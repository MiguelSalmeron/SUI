import { onRequest } from 'firebase-functions/v2/https';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import { avatarPath, parseIdentity } from '@sui/contracts';
import { authenticateBearer } from '../chat/auth';
import { firestore } from '../chat/firebase';
import { verifyAppCheckHeader } from '../http/appCheck';
import { setCorsHeaders } from '../http/cors';
export const deleteAvatar = async (uid: string): Promise<void> => {
  await getStorage().bucket().file(avatarPath(uid)).delete({ ignoreNotFound: true });
};
export const updateIdentity = onRequest({ cors: false }, async (request, response) => {
  if (!setCorsHeaders(request, response)) {
    response.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (
    !(await verifyAppCheckHeader(
      typeof request.headers['x-firebase-appcheck'] === 'string'
        ? request.headers['x-firebase-appcheck']
        : undefined,
      'updateIdentity',
    ))
  ) {
    response.status(401).json({ error: 'Invalid App Check token' });
    return;
  }
  const authentication = await authenticateBearer(request.headers.authorization);
  if (!authentication.ok) {
    response.status(401).json({ error: 'Invalid authentication' });
    return;
  }
  if (
    authentication.signInProvider === 'anonymous' ||
    authentication.signInProvider === 'unknown' ||
    (authentication.signInProvider === 'password' && !authentication.emailVerified)
  ) {
    response.status(403).json({ error: 'Registered account required' });
    return;
  }
  const body = request.body;
  const identity = parseIdentity(body?.identity, authentication.uid);
  if (
    !identity ||
    !body ||
    Object.keys(body).some((key) => !['identity', 'clearPhoto'].includes(key)) ||
    typeof body.clearPhoto !== 'boolean' ||
    (body.clearPhoto && identity.avatarSource === 'photo')
  ) {
    response.status(400).json({ error: 'Invalid identity' });
    return;
  }
  try {
    const document = firestore.collection('users').doc(authentication.uid);
    if (body.clearPhoto) await deleteAvatar(authentication.uid);
    if (identity.photoPath) {
      const bucket = getStorage().bucket();
      const file = bucket.file(avatarPath(authentication.uid));
      const [metadata] = await file.getMetadata().catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error.code === 404 || error.code === '404')
        )
          return [null];
        throw error;
      });
      if (!metadata) {
        response.status(400).json({ error: 'Photo missing. Choose a photo again.' });
        return;
      }
      if (
        Number(metadata.size) > 1048576 ||
        !['image/webp', 'image/jpeg'].includes(metadata.contentType ?? '')
      ) {
        response.status(400).json({ error: 'Invalid photo' });
        return;
      }
      const storedToken = metadata.metadata?.firebaseStorageDownloadTokens;
      const token =
        typeof storedToken === 'string' && storedToken ? storedToken.split(',')[0] : randomUUID();
      if (!storedToken)
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      identity.photoUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(identity.photoPath)}?alt=media&token=${token}`;
    }
    identity.updatedAt = new Date().toISOString();
    await document.set({ identity }, { mergeFields: ['identity'] });
    response.status(200).json({ identity });
  } catch {
    response.status(500).json({ error: 'Identity update failed' });
  }
});
