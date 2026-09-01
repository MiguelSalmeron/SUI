import { linkWithCredential, type User } from 'firebase/auth';

// Mock global de firebase/auth y config/firebase para aislar tests.
jest.mock('firebase/auth', () => ({
  linkWithCredential: jest.fn(),
  EmailAuthProvider: {
    credential: (email: string, password: string) => ({ email, password }),
  },
}));

jest.mock('@/shared/infrastructure/firebase/firebase', () => ({
  auth: { currentUser: null as User | null },
}));

const mockedLink = linkWithCredential as jest.MockedFunction<typeof linkWithCredential>;
const { auth } = require('@/shared/infrastructure/firebase/firebase') as {
  auth: { currentUser: User | null };
};
const { upgradeAnonymousToEmail } = require('../accountMigration');

function setAnonUser(uid: string): void {
  auth.currentUser = {
    uid,
    isAnonymous: true,
  } as unknown as User;
}

function clearUser(): void {
  auth.currentUser = null;
}

describe('accountMigration · upgradeAnonymousToEmail', () => {
  beforeEach(() => {
    mockedLink.mockReset();
  });

  afterEach(() => {
    clearUser();
  });

  it('enlaza cuenta anónima activa y preserva uid', async () => {
    setAnonUser('anon-123');
    mockedLink.mockResolvedValueOnce({} as never);
    const res = await upgradeAnonymousToEmail('Usuario@Ejemplo.COM', '123456');
    expect(res.ok).toBe(true);
    expect(res.uid).toBe('anon-123');
    expect(res.linked).toBe(true);
    expect(mockedLink).toHaveBeenCalledTimes(1);
    const [user, cred] = mockedLink.mock.calls[0];
    expect((user as User).uid).toBe('anon-123');
    expect(cred).toEqual({ email: 'usuario@ejemplo.com', password: '123456' });
  });

  it('devuelve error claro si el email ya está en uso', async () => {
    setAnonUser('anon-123');
    mockedLink.mockRejectedValueOnce({ code: 'auth/email-already-in-use' } as never);
    const res = await upgradeAnonymousToEmail('a@b.com', '123456');
    expect(res.ok).toBe(false);
    expect(res.linked).toBe(false);
    expect(res.error).toContain('email ya pertenece');
  });

  it('devuelve error claro si la contraseña es débil', async () => {
    setAnonUser('anon-123');
    mockedLink.mockRejectedValueOnce({ code: 'auth/weak-password' } as never);
    const res = await upgradeAnonymousToEmail('a@b.com', '123');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('muy débil');
  });

  it('sin sesión anónima activa indica que se use login', async () => {
    const res = await upgradeAnonymousToEmail('a@b.com', '123456');
    expect(res.ok).toBe(false);
    expect(res.linked).toBe(false);
    expect(res.error).toContain('Inicia sesión');
  });

  it('email-no-anónimo (isAnonymous=false) también cae a login', async () => {
    auth.currentUser = { uid: 'real-user', isAnonymous: false } as unknown as User;
    const res = await upgradeAnonymousToEmail('a@b.com', '123456');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Inicia sesión');
  });
});
