import { auth, getAppCheckToken } from '@/shared/infrastructure/firebase/firebase';
import { parseSyncResponse } from '@sui/contracts';
import type { SyncRequestV9, SyncResponseV9 } from './syncTypes';

const API_BASE = process.env.EXPO_PUBLIC_SYNC_API_URL?.trim().replace(/\/$/, '') ?? '';

export const requestProductivitySync = async (request: SyncRequestV9): Promise<SyncResponseV9> => {
  const user = auth.currentUser;
  if (!user) throw new Error('sync-auth-required');
  if (!API_BASE) throw new Error('sync-api-not-configured');
  const [idToken, appCheckToken] = await Promise.all([user.getIdToken(), getAppCheckToken()]);
  const response = await fetch(`${API_BASE}/syncProductivity`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`sync-http-${response.status}`);
  const body: unknown = await response.json();
  const parsed = parseSyncResponse(body);
  if (!parsed) throw new Error('sync-invalid-response');
  return parsed;
};
