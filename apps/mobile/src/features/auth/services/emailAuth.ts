import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/shared/infrastructure/firebase/firebase';

export type EmailAuthResult = {
  ok: boolean;
  uid?: string;
  linked?: boolean;
  verificationSent?: boolean;
  error?: string;
};

const errorMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-email':
      return 'auth/invalid-email';
    case 'auth/email-already-in-use':
      return 'auth/email-already-in-use';
    case 'auth/weak-password':
      return 'auth/weak-password';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'auth/invalid-credential';
    case 'auth/too-many-requests':
      return 'auth/too-many-requests';
    case 'auth/network-request-failed':
      return 'auth/network-request-failed';
    default:
      return 'auth/unknown';
  }
};

export const createOrLinkEmailAccount = async (
  email: string,
  password: string,
): Promise<EmailAuthResult> => {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const current = auth.currentUser;
    const credential = EmailAuthProvider.credential(cleanEmail, password);
    const result = current?.isAnonymous
      ? await linkWithCredential(current, credential)
      : await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await sendEmailVerification(result.user);
    return {
      ok: true,
      uid: result.user.uid,
      linked: Boolean(current?.isAnonymous),
      verificationSent: true,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
};

export const signInEmailAccount = async (
  email: string,
  password: string,
): Promise<EmailAuthResult> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return { ok: true, uid: result.user.uid, linked: false };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
};

export const requestPasswordReset = async (email: string): Promise<EmailAuthResult> => {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
};
