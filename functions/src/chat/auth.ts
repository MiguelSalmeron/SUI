import { getAuth } from 'firebase-admin/auth';

export type AuthenticationResult =
  | {
      ok: true;
      uid: string;
      emailVerified: boolean;
      signInProvider: string;
    }
  | { ok: false; reason: 'missing'; authHeaderLength: number }
  | { ok: false; reason: 'invalid'; tokenLength: number; error: unknown };

export async function authenticateBearer(
  authorization: string | undefined,
): Promise<AuthenticationResult> {
  const authHeader = authorization ?? '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return { ok: false, reason: 'missing', authHeaderLength: authHeader.length };
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return {
      ok: true,
      uid: decoded.uid,
      emailVerified: decoded.email_verified === true,
      signInProvider:
        typeof decoded.firebase?.sign_in_provider === 'string'
          ? decoded.firebase.sign_in_provider
          : 'unknown',
    };
  } catch (error) {
    return { ok: false, reason: 'invalid', tokenLength: match[1].length, error };
  }
}
