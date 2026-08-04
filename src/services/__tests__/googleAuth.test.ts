import {
  linkWithCredential,
  signInWithCredential,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';

jest.mock('firebase/auth', () => ({
  linkWithCredential: jest.fn(),
  signInWithCredential: jest.fn(),
  GoogleAuthProvider: {
    credential: (idToken: string) => ({ idToken }),
  },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: null as User | null },
}));

const mockedLink = linkWithCredential as jest.MockedFunction<typeof linkWithCredential>;
const mockedSignIn = signInWithCredential as jest.MockedFunction<typeof signInWithCredential>;
const { auth } = require('../../config/firebase') as { auth: { currentUser: User | null } };
const {
  linkOrSignInWithGoogleIdToken,
  userHasGoogleProvider,
} = require('../googleAuth');

function setAnonUser(uid: string): void {
  auth.currentUser = {
    uid,
    isAnonymous: true,
    providerData: [],
  } as unknown as User;
}

function setGoogleUser(uid: string, email: string): void {
  auth.currentUser = {
    uid,
    isAnonymous: false,
    email,
    providerData: [{ providerId: 'google.com', email }],
  } as unknown as User;
}

function clearUser(): void {
  auth.currentUser = null;
}

describe('googleAuth · userHasGoogleProvider', () => {
  it('detecta proveedor Google', () => {
    setGoogleUser('u1', 'a@b.com');
    expect(userHasGoogleProvider(auth.currentUser)).toBe(true);
  });

  it('false para anónimo', () => {
    setAnonUser('anon');
    expect(userHasGoogleProvider(auth.currentUser)).toBe(false);
  });

  it('false para null', () => {
    expect(userHasGoogleProvider(null)).toBe(false);
  });
});

describe('googleAuth · linkOrSignInWithGoogleIdToken', () => {
  beforeEach(() => {
    mockedLink.mockReset();
    mockedSignIn.mockReset();
  });

  afterEach(() => {
    clearUser();
  });

  it('rechaza token vacío', async () => {
    const res = await linkOrSignInWithGoogleIdToken('   ');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('token');
  });

  it('enlaza cuenta anónima y preserva uid', async () => {
    setAnonUser('anon-99');
    mockedLink.mockResolvedValueOnce({} as never);
    const res = await linkOrSignInWithGoogleIdToken('id-token-xyz');
    expect(res.ok).toBe(true);
    expect(res.uid).toBe('anon-99');
    expect(res.linked).toBe(true);
    expect(mockedLink).toHaveBeenCalledTimes(1);
    expect(mockedSignIn).not.toHaveBeenCalled();
    const [, cred] = mockedLink.mock.calls[0];
    expect(cred).toEqual({ idToken: 'id-token-xyz' });
  });

  it('sin anónimo usa signInWithCredential', async () => {
    clearUser();
    mockedSignIn.mockResolvedValueOnce({
      user: { uid: 'google-uid' },
    } as never);
    const res = await linkOrSignInWithGoogleIdToken('tok');
    expect(res.ok).toBe(true);
    expect(res.uid).toBe('google-uid');
    expect(res.linked).toBe(false);
    expect(mockedSignIn).toHaveBeenCalledTimes(1);
    expect(GoogleAuthProvider.credential).toBeDefined();
  });

  it('si ya tiene Google vinculado no re-loguea', async () => {
    setGoogleUser('g-1', 'a@b.com');
    const res = await linkOrSignInWithGoogleIdToken('tok');
    expect(res.ok).toBe(true);
    expect(res.uid).toBe('g-1');
    expect(mockedSignIn).not.toHaveBeenCalled();
    expect(mockedLink).not.toHaveBeenCalled();
  });

  it('mapea credential-already-in-use', async () => {
    setAnonUser('anon-1');
    mockedLink.mockRejectedValueOnce({ code: 'auth/credential-already-in-use' } as never);
    const res = await linkOrSignInWithGoogleIdToken('tok');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Continuar con Google');
  });

  it('mapea operation-not-allowed', async () => {
    setAnonUser('anon-1');
    mockedLink.mockRejectedValueOnce({ code: 'auth/operation-not-allowed' } as never);
    const res = await linkOrSignInWithGoogleIdToken('tok');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Firebase Console');
  });
});
