import { auth, getAppCheckToken } from '@/shared/infrastructure/firebase/firebase';

const API_BASE = process.env.EXPO_PUBLIC_CONNECTIONS_API_URL?.trim().replace(/\/$/, '') ?? '';

export const deleteRegisteredAccount = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user || user.isAnonymous || !API_BASE) throw new Error('account-deletion-unavailable');
  const [idToken, appCheckToken] = await Promise.all([user.getIdToken(), getAppCheckToken()]);
  const response = await fetch(`${API_BASE}/deleteAccount`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error('account-deletion-failed');
};
